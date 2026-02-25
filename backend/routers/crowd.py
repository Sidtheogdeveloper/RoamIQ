"""
Crowd / traffic endpoints powered by BestTime API.
Falls back to predicted crowd data when API data is unavailable.
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional

from services.crowd_predictor import predict_busyness, classify_venue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/crowd", tags=["Crowd & Traffic"])


# ── Dependency to get BestTime client ─────────────────────────
def get_besttime():
    from main import besttime_client
    return besttime_client


# ── Request / Response Models ─────────────────────────────────
class VenueSearchRequest(BaseModel):
    query: str
    num: int = 5


class ItineraryActivity(BaseModel):
    title: str
    location: Optional[str] = None
    start_time: Optional[str] = None
    day_of_week: Optional[int] = None  # 0=Mon..6=Sun


class AnalyzeItineraryRequest(BaseModel):
    destination: str
    activities: list[ItineraryActivity]


# ── Helper: extract venues from BestTime progress response ────
def extract_venues_from_progress(data) -> list[dict]:
    """
    BestTime venue_search returns progress data. Venues may be found
    in 'venues' (raw format), 'venues_forecasts', or nested under
    'venue_info' in individual items.
    Handles both dict and list responses from the API.
    """
    # If data is already a list of venues, return it directly
    if isinstance(data, list):
        return data

    # If data is not a dict, return empty
    if not isinstance(data, dict):
        return []

    # Direct venues list (raw format from progress endpoint)
    venues = data.get("venues", [])
    if venues:
        return venues if isinstance(venues, list) else []

    # Venue forecasts list
    forecasts = data.get("venues_forecasts", [])
    if forecasts:
        return forecasts if isinstance(forecasts, list) else []

    # Try 'venue_info' wrapper
    venue_info = data.get("venue_info", [])
    if venue_info:
        return venue_info if isinstance(venue_info, list) else []

    return []


# ── Helper: extract busyness from venue data ──────────────────
def extract_busyness_from_venue(venue: dict, day_of_week: Optional[int] = None, hour: Optional[int] = None) -> Optional[float]:
    """Try multiple paths to extract busyness from a venue dict."""
    # Try venue_foot_traffic_forecast first
    ft = venue.get("venue_foot_traffic_forecast") or venue.get("forecast") or {}
    analysis = ft.get("analysis", {})

    # Try to get specific day+hour data
    if day_of_week is not None:
        day_raw = analysis.get("day_raw", [])
        if day_raw and hour is not None and 0 <= hour < len(day_raw):
            val = day_raw[hour]
            if isinstance(val, (int, float)) and val >= 0:
                return float(val)

    # Try week_raw for average
    week_raw = analysis.get("week_raw", [])
    if week_raw:
        all_hours = []
        for day in week_raw:
            if isinstance(day, list):
                all_hours.extend([h for h in day if isinstance(h, (int, float)) and h > 0])
        if all_hours:
            return round(sum(all_hours) / len(all_hours), 1)

    # Try direct busyness fields
    for key in ["venue_forecasted_busyness", "busyness", "busy_pct"]:
        val = venue.get(key)
        if isinstance(val, (int, float)):
            return float(val)

    return None


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/venue-search")
async def venue_search(req: VenueSearchRequest, bt=Depends(get_besttime)):
    """Search venues by name/area and get foot-traffic data."""
    if not bt or not bt.is_configured:
        raise HTTPException(
            status_code=503,
            detail="BestTime API keys are not configured. Set BESTTIME_API_KEY_PRIVATE and BESTTIME_API_KEY_PUBLIC in your .env file.",
        )
    try:
        data = await bt.venue_search(req.query, req.num)
        return data
    except Exception as e:
        logger.error(f"BestTime venue_search failed for query='{req.query}': {e}")
        raise HTTPException(status_code=502, detail=f"BestTime API error: {str(e)}")


@router.get("/forecast/{venue_id}")
async def get_forecast(
    venue_id: str,
    day: Optional[int] = Query(None, ge=0, le=6, description="0=Mon..6=Sun"),
    bt=Depends(get_besttime),
):
    """Get crowd forecast for a venue."""
    if not bt or not bt.is_configured:
        raise HTTPException(status_code=503, detail="BestTime API keys not configured.")
    try:
        if day is not None:
            data = await bt.get_forecast_day(venue_id, day)
        else:
            data = await bt.get_forecast_week(venue_id)
        return data
    except Exception as e:
        logger.error(f"BestTime forecast failed for venue_id='{venue_id}': {e}")
        raise HTTPException(status_code=502, detail=f"BestTime API error: {str(e)}")


@router.get("/live/{venue_id}")
async def get_live_busyness(venue_id: str, bt=Depends(get_besttime)):
    """Get current live busyness percentage for a venue."""
    if not bt or not bt.is_configured:
        raise HTTPException(status_code=503, detail="BestTime API keys not configured.")
    try:
        data = await bt.get_live(venue_id)
        return data
    except Exception as e:
        logger.error(f"BestTime live failed for venue_id='{venue_id}': {e}")
        raise HTTPException(status_code=502, detail=f"BestTime API error: {str(e)}")


@router.get("/best-times/{venue_id}")
async def get_best_times(venue_id: str, bt=Depends(get_besttime)):
    """Get the quietest and busiest times for a venue."""
    if not bt or not bt.is_configured:
        raise HTTPException(status_code=503, detail="BestTime API keys not configured.")
    try:
        data = await bt.get_best_times(venue_id)
        return data
    except Exception as e:
        logger.error(f"BestTime best_times failed for venue_id='{venue_id}': {e}")
        raise HTTPException(status_code=502, detail=f"BestTime API error: {str(e)}")


@router.post("/analyze-itinerary")
async def analyze_itinerary(req: AnalyzeItineraryRequest, bt=Depends(get_besttime)):
    """
    Analyze crowd levels for each activity in an itinerary.
    Searches for each venue and returns busyness data + optimization tips.
    Falls back gracefully when BestTime API is unavailable.
    """
    api_available = bt and bt.is_configured

    if not api_available:
        logger.warning("BestTime API not configured — returning fallback crowd data")

    results = []
    for activity in req.activities:
        if not api_available:
            # Use prediction when API is not available
            hour = None
            if activity.start_time:
                try:
                    hour = int(activity.start_time.split(":")[0])
                except (ValueError, IndexError):
                    pass
            pred_pct, pred_tip, venue_type = predict_busyness(
                activity.title, activity.location, hour, activity.day_of_week
            )
            results.append({
                "activity": activity.title,
                "venue_name": None,
                "venue_id": None,
                "busyness_at_planned_time": pred_pct,
                "optimization_tip": pred_tip,
                "venue_info": {"type": venue_type},
                "api_available": False,
                "is_predicted": True,
            })
            continue

        search_query = f"{activity.title} in {req.destination}"
        if activity.location:
            search_query = f"{activity.title} {activity.location}"

        # Parse hour from start_time
        hour = None
        if activity.start_time:
            try:
                hour = int(activity.start_time.split(":")[0])
            except (ValueError, IndexError):
                pass

        try:
            logger.info(f"Searching BestTime for: '{search_query}'")
            search_data = await bt.venue_search(search_query, num=1)
            venues = extract_venues_from_progress(search_data)

            if not venues:
                logger.info(f"No venues found for: '{search_query}' — using prediction")
                # Fallback to predicted data
                pred_pct, pred_tip, venue_type = predict_busyness(
                    activity.title, activity.location, hour, activity.day_of_week
                )
                results.append({
                    "activity": activity.title,
                    "venue_name": None,
                    "venue_id": None,
                    "busyness_at_planned_time": pred_pct,
                    "optimization_tip": pred_tip,
                    "venue_info": {"type": venue_type},
                    "is_predicted": True,
                })
                continue

            venue = venues[0]
            venue_id = venue.get("venue_id") if isinstance(venue, dict) else None
            venue_name = (venue.get("venue_name", "Unknown") if isinstance(venue, dict) else "Unknown")
            logger.info(f"Found venue: '{venue_name}' (id={venue_id})")

            busyness_at_time = extract_busyness_from_venue(
                venue, activity.day_of_week, hour
            )

            # If no busyness yet, try fetching forecast separately
            if busyness_at_time is None and venue_id and activity.day_of_week is not None:
                try:
                    forecast = await bt.get_forecast_day(venue_id, activity.day_of_week)
                    if isinstance(forecast, dict):
                        day_raw = forecast.get("analysis", {}).get("day_raw", [])
                        if day_raw and hour is not None and 0 <= hour < len(day_raw):
                            busyness_at_time = day_raw[hour]
                            logger.info(f"Busyness at hour {hour}: {busyness_at_time}%")
                except Exception as fe:
                    logger.warning(f"Forecast fetch failed for venue={venue_id}: {fe}")

            # If still no busyness from API, use prediction
            is_predicted = False
            if busyness_at_time is not None:
                if busyness_at_time > 80:
                    tip = "🔴 Very crowded at this time! Consider visiting earlier or later."
                elif busyness_at_time > 60:
                    tip = "🟡 Moderately busy. Plan extra time for queues."
                elif busyness_at_time > 30:
                    tip = "🟢 Reasonable crowd levels."
                else:
                    tip = "✅ Great time to visit — minimal crowds!"
            else:
                # Use prediction as fallback
                pred_pct, pred_tip, _ = predict_busyness(
                    activity.title, activity.location, hour, activity.day_of_week
                )
                busyness_at_time = pred_pct
                tip = pred_tip
                is_predicted = True

            results.append({
                "activity": activity.title,
                "venue_name": venue_name,
                "venue_id": venue_id,
                "busyness_at_planned_time": busyness_at_time,
                "optimization_tip": tip,
                "venue_info": {
                    "address": venue.get("venue_address") if isinstance(venue, dict) else None,
                    "type": venue.get("venue_type") if isinstance(venue, dict) else None,
                },
                "is_predicted": is_predicted,
            })
        except Exception as e:
            logger.error(f"BestTime analysis failed for '{activity.title}': {e}")
            # Even on error, provide predicted data
            pred_pct, pred_tip, venue_type = predict_busyness(
                activity.title, activity.location, hour, activity.day_of_week
            )
            results.append({
                "activity": activity.title,
                "venue_name": None,
                "venue_id": None,
                "busyness_at_planned_time": pred_pct,
                "optimization_tip": pred_tip,
                "venue_info": {"type": venue_type},
                "is_predicted": True,
            })

    return {
        "destination": req.destination,
        "analysis": results,
        "api_configured": api_available,
    }
