"""
BestTime API client wrapper.
Docs: https://besttime.app/api/v1

The venue search endpoint is asynchronous – it returns a job_id that must
be polled via the progress endpoint until the job finishes.
"""

import asyncio
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

BASE_URL = "https://besttime.app/api/v1"


class BestTimeClient:
    def __init__(self, api_key_private: str, api_key_public: str):
        self.api_key_private = api_key_private
        self.api_key_public = api_key_public
        self.client = httpx.AsyncClient(timeout=30.0)

    @property
    def is_configured(self) -> bool:
        """Check if both API keys are set and not the default dummy values."""
        if not self.api_key_private or not self.api_key_public:
            return False
        if "your_private_key" in self.api_key_private or "your_public" in self.api_key_public:
            return False
        return True

    async def close(self):
        await self.client.aclose()

    # ── Venue Search (async with polling) ─────────────────────
    async def venue_search(self, query: str, num: int = 5) -> dict:
        """
        Search venues by name/area and get foot-traffic forecasts.
        BestTime runs this in the background, so we poll for completion.
        Returns the final progress response which includes venue data.
        """
        logger.info(f"BestTime venue_search: q='{query}', num={num}")

        # Step 1: Start the search job
        resp = await self.client.post(
            f"{BASE_URL}/venues/search",
            params={
                "api_key_private": self.api_key_private,
                "q": query,
                "num": num,
            },
        )
        resp.raise_for_status()
        start_data = resp.json()

        job_id = start_data.get("job_id")
        collection_id = start_data.get("collection_id")

        if not job_id or not collection_id:
            logger.warning(f"venue_search did not return job_id/collection_id: {start_data}")
            return start_data

        logger.info(f"BestTime search job started: job_id={job_id}, collection_id={collection_id}")

        # Step 2: Poll for progress until job_finished=True (max ~30s)
        max_polls = 15
        poll_interval = 2  # seconds
        for i in range(max_polls):
            await asyncio.sleep(poll_interval)
            try:
                progress_resp = await self.client.get(
                    f"{BASE_URL}/venues/progress",
                    params={
                        "job_id": job_id,
                        "collection_id": collection_id,
                        "format": "raw",
                    },
                )
                progress_resp.raise_for_status()
                progress_data = progress_resp.json()

                job_finished = progress_data.get("job_finished", False)
                count_completed = progress_data.get("count_completed", 0)
                count_total = progress_data.get("count_total", 0)

                logger.info(
                    f"Poll {i+1}/{max_polls}: finished={job_finished}, "
                    f"completed={count_completed}/{count_total}"
                )

                if job_finished:
                    # Return the progress response which includes venue data
                    return progress_data

            except Exception as e:
                logger.warning(f"Poll {i+1} failed: {e}")
                continue

        logger.warning(f"venue_search timed out after {max_polls * poll_interval}s")
        # Return whatever we have so far
        return progress_data if 'progress_data' in dir() else start_data

    # ── New Forecast ──────────────────────────────────────────
    async def new_forecast(self, venue_name: str, venue_address: str) -> dict:
        """Create a new foot-traffic forecast for a venue."""
        resp = await self.client.post(
            f"{BASE_URL}/forecasts",
            params={
                "api_key_private": self.api_key_private,
                "venue_name": venue_name,
                "venue_address": venue_address,
            },
        )
        resp.raise_for_status()
        return resp.json()

    # ── Get Forecast (week overview) ──────────────────────────
    async def get_forecast_week(self, venue_id: str) -> dict:
        """Get the weekly forecast overview for a venue."""
        resp = await self.client.get(
            f"{BASE_URL}/forecasts/weekly",
            params={
                "api_key_public": self.api_key_public,
                "venue_id": venue_id,
            },
        )
        resp.raise_for_status()
        return resp.json()

    # ── Get Forecast (specific day) ───────────────────────────
    async def get_forecast_day(self, venue_id: str, day_int: int) -> dict:
        """
        Get hourly forecast for a specific day.
        day_int: 0=Mon, 1=Tue, ..., 6=Sun
        """
        resp = await self.client.get(
            f"{BASE_URL}/forecasts/daily",
            params={
                "api_key_public": self.api_key_public,
                "venue_id": venue_id,
                "day_int": day_int,
            },
        )
        resp.raise_for_status()
        return resp.json()

    # ── Get Forecast (specific hour) ──────────────────────────
    async def get_forecast_hour(self, venue_id: str, day_int: int, hour: int) -> dict:
        """Get forecast for a specific hour on a specific day."""
        resp = await self.client.get(
            f"{BASE_URL}/forecasts/hourly",
            params={
                "api_key_public": self.api_key_public,
                "venue_id": venue_id,
                "day_int": day_int,
                "hour": hour,
            },
        )
        resp.raise_for_status()
        return resp.json()

    # ── Live Busyness ─────────────────────────────────────────
    async def get_live(self, venue_id: str) -> dict:
        """Get current live busyness for a venue."""
        resp = await self.client.get(
            f"{BASE_URL}/forecasts/live",
            params={
                "api_key_public": self.api_key_public,
                "venue_id": venue_id,
            },
        )
        resp.raise_for_status()
        return resp.json()

    # ── Best Times (quiet/busy) ───────────────────────────────
    async def get_best_times(self, venue_id: str) -> dict:
        """Get peak and quiet hours for a venue."""
        resp = await self.client.get(
            f"{BASE_URL}/forecasts/best",
            params={
                "api_key_public": self.api_key_public,
                "venue_id": venue_id,
            },
        )
        resp.raise_for_status()
        return resp.json()

    # ── Venue Filter ──────────────────────────────────────────
    async def venue_filter(
        self,
        venue_filter_type: str,  # "now", "day", "week"
        lat: float,
        lng: float,
        radius: int = 2000,
        busy_min: Optional[int] = None,
        busy_max: Optional[int] = None,
        types: Optional[list[str]] = None,
    ) -> dict:
        """Filter venues by busyness, location, type, etc."""
        params: dict = {
            "api_key_private": self.api_key_private,
            "busy_conf": venue_filter_type,
            "lat": lat,
            "lng": lng,
            "radius": radius,
        }
        if busy_min is not None:
            params["busy_min"] = busy_min
        if busy_max is not None:
            params["busy_max"] = busy_max
        if types:
            params["types"] = types

        resp = await self.client.get(
            f"{BASE_URL}/venues/filter",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()
