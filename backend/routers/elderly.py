"""
Elderly-friendly mode endpoints.
Provides suggestions and itinerary optimization for elderly travelers.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from services.elderly_scorer import (
    score_venue_for_elderly,
    rank_activities_for_elderly,
    estimate_distance_from_duration,
    estimate_steps_from_duration,
    VenueScore,
)
from services.crowd_predictor import predict_busyness
from routers.crowd import extract_venues_from_progress

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/elderly", tags=["Elderly Mode"])


# ── Dependency to get BestTime client ─────────────────────────
def get_besttime():
    from main import besttime_client
    return besttime_client


# ── Request / Response Models ─────────────────────────────────
class ElderlyActivity(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    is_outdoor: bool = False
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    day_of_week: Optional[int] = None  # 0=Mon..6=Sun
    start_time: Optional[str] = None


class ElderlyOptimizeRequest(BaseModel):
    destination: str
    activities: list[ElderlyActivity]


class ElderlySearchRequest(BaseModel):
    destination: str
    types: Optional[list[str]] = None  # e.g. ["museum", "cafe", "restaurant"]
    num: int = 10


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/suggestions", response_model=list[VenueScore])
async def get_elderly_suggestions(req: ElderlySearchRequest, bt=Depends(get_besttime)):
    """
    Get elderly-friendly venue suggestions for a destination.
    Searches venues, fetches crowd data, and scores for elderly suitability.
    """
    api_available = bt and bt.is_configured
    if not api_available:
        logger.warning("BestTime API not configured — returning heuristic suggestions")
        raise HTTPException(
            status_code=503,
            detail="BestTime API keys not configured. Elderly suggestions require crowd data.",
        )

    # Default to elderly-friendly venue types
    search_types = req.types or ["museum", "cafe", "restaurant", "temple", "garden", "gallery"]

    all_venues = []
    for venue_type in search_types:
        query = f"{venue_type} in {req.destination}"
        try:
            logger.info(f"Searching elderly venues: '{query}'")
            data = await bt.venue_search(query, num=3)
            venues = extract_venues_from_progress(data)
            for v in venues:
                if not isinstance(v, dict):
                    continue
                busyness = None
                forecast = v.get("venue_foot_traffic_forecast")
                if forecast and isinstance(forecast, dict):
                    analysis = forecast.get("analysis", {})
                    week_raw = analysis.get("week_raw", [])
                    if week_raw:
                        all_hours = [h for day in week_raw if isinstance(day, list) for h in day if isinstance(h, (int, float)) and h > 0]
                        busyness = sum(all_hours) / len(all_hours) if all_hours else None

                all_venues.append({
                    "name": v.get("venue_name", "Unknown"),
                    "busyness_pct": busyness,
                    "is_outdoor": False,
                    "duration_minutes": 60,
                    "type": venue_type,
                    "description": v.get("venue_type", ""),
                    "has_seating": True,
                })
        except Exception as e:
            logger.error(f"BestTime venue search failed for '{query}': {e}")
            continue

    if not all_venues:
        raise HTTPException(status_code=404, detail="No venues found for the given destination")

    scored = rank_activities_for_elderly(all_venues)
    return scored[:req.num]


@router.post("/optimize-itinerary")
async def optimize_itinerary(req: ElderlyOptimizeRequest, bt=Depends(get_besttime)):
    """
    Analyze and optimize an itinerary for elderly travelers.
    Returns scored activities + optimization suggestions.
    Works with or without BestTime API — uses heuristic scoring as fallback.
    """
    api_available = bt and bt.is_configured
    if not api_available:
        logger.warning("BestTime API not configured — using heuristic-only elderly scoring")

    enriched_activities = []

    for activity in req.activities:
        busyness = None

        # Try to get crowd data for the activity (only if API is available)
        if api_available and (activity.location or activity.title):
            search_query = f"{activity.title} in {req.destination}"
            if activity.location:
                search_query = f"{activity.title} {activity.location}"

            try:
                logger.info(f"Elderly analysis — searching BestTime for: '{search_query}'")
                data = await bt.venue_search(search_query, num=1)
                venues = extract_venues_from_progress(data)
                if venues:
                    venue = venues[0]
                    if isinstance(venue, dict):
                        venue_id = venue.get("venue_id")
                        logger.info(f"Found venue: '{venue.get('venue_name')}' for '{activity.title}'")

                        # Get busyness at planned time
                        if venue_id and activity.day_of_week is not None:
                            try:
                                forecast = await bt.get_forecast_day(venue_id, activity.day_of_week)
                                if isinstance(forecast, dict) and activity.start_time:
                                    hour = int(activity.start_time.split(":")[0])
                                    day_raw = forecast.get("analysis", {}).get("day_raw", [])
                                    if day_raw and 0 <= hour < len(day_raw):
                                        busyness = day_raw[hour]
                                        logger.info(f"Busyness for '{activity.title}' at hour {hour}: {busyness}%")
                            except Exception as fe:
                                logger.warning(f"Forecast fetch failed for '{activity.title}': {fe}")

                        # Fallback: weekly average
                        if busyness is None:
                            ft = venue.get("venue_foot_traffic_forecast", {}) or {}
                            analysis = ft.get("analysis", {}) if isinstance(ft, dict) else {}
                            week_raw = analysis.get("week_raw", [])
                            if week_raw:
                                all_hours = [h for day in week_raw if isinstance(day, list) for h in day if isinstance(h, (int, float)) and h > 0]
                                busyness = sum(all_hours) / len(all_hours) if all_hours else None
            except Exception as e:
                logger.error(f"BestTime failed for '{activity.title}': {e}")

        # Use crowd prediction as fallback if no busyness from API
        if busyness is None:
            hour = None
            if activity.start_time:
                try:
                    hour = int(activity.start_time.split(":")[0])
                except (ValueError, IndexError):
                    pass
            pred_pct, _, _ = predict_busyness(
                activity.title, activity.location, hour, activity.day_of_week
            )
            busyness = pred_pct

        # Compute estimated distance and steps from real activity data
        dist_km = estimate_distance_from_duration(
            activity.duration_minutes,
            activity.is_outdoor,
            activity.category,
        )
        steps = estimate_steps_from_duration(
            activity.duration_minutes,
            activity.is_outdoor,
            activity.category,
        )

        enriched_activities.append({
            "name": activity.title,
            "busyness_pct": busyness,
            "is_outdoor": activity.is_outdoor,
            "duration_minutes": activity.duration_minutes,
            "type": activity.category,
            "description": activity.description,
            "has_seating": True,
            "distance_km": dist_km,
            "estimated_steps": steps,
        })

    scored = rank_activities_for_elderly(enriched_activities)

    # Generate overall recommendations
    suggestions = []

    high_risk = [s for s in scored if s.overall_score < 40]
    moderate_risk = [s for s in scored if 40 <= s.overall_score < 55]

    if high_risk:
        suggestions.append(
            f"⚠️ {len(high_risk)} activities may be challenging for elderly travelers: "
            + ", ".join(s.name for s in high_risk)
        )

    if moderate_risk:
        suggestions.append(
            f"🟡 {len(moderate_risk)} activities need some adjustments: "
            + ", ".join(s.name for s in moderate_risk)
        )

    # Contextual tips based on actual activity data
    long_activities = [s for s in scored if any("Long duration" in r for r in s.reasons)]
    if long_activities:
        suggestions.append(
            f"⏰ {len(long_activities)} activities are long — schedule 15-30 min rest breaks."
        )

    high_walk = [s for s in scored if s.walkability_score < 40]
    if high_walk:
        suggestions.append(
            f"🚕 Consider taxi/auto for: " + ", ".join(s.name for s in high_walk)
        )

    suggestions.append(
        "💡 Schedule the most physically demanding activities in the morning when energy is highest."
    )
    suggestions.append(
        "🪑 Plan rest breaks of 15-30 minutes between activities."
    )

    if not api_available:
        suggestions.append(
            "ℹ️ Scores are estimated without crowd data. Configure BestTime API for more accurate results."
        )

    overall_score = round(
        sum(s.overall_score for s in scored) / len(scored), 1
    ) if scored else 0

    logger.info(f"Elderly optimization complete: {len(scored)} activities, overall score={overall_score}")

    return {
        "destination": req.destination,
        "scored_activities": [s.model_dump() for s in scored],
        "suggestions": suggestions,
        "overall_elderly_score": overall_score,
        "api_configured": api_available,
    }
