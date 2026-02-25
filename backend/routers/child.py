"""
Child-friendly mode endpoints.
Provides kid-friendly scoring and itinerary optimization for family travelers.
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.child_scorer import (
    score_activity_for_child,
    rank_activities_for_children,
    get_kid_suggestions,
    ChildScore,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/child", tags=["Child Mode"])


# ── Request / Response Models ─────────────────────────────────
class ChildActivity(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    is_outdoor: bool = False
    duration_minutes: Optional[int] = None
    category: Optional[str] = None


class ChildOptimizeRequest(BaseModel):
    destination: str
    activities: list[ChildActivity]


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/optimize-itinerary")
async def optimize_itinerary_for_children(req: ChildOptimizeRequest):
    """
    Analyze and optimize an itinerary for children.
    Returns scored activities + fun suggestions.
    """
    enriched = []
    for activity in req.activities:
        enriched.append({
            "name": activity.title,
            "description": activity.description,
            "is_outdoor": activity.is_outdoor,
            "duration_minutes": activity.duration_minutes,
            "type": activity.category,
        })

    scored = rank_activities_for_children(enriched)

    # Generate suggestions
    suggestions = []
    boring = [s for s in scored if s.overall_score < 40]
    okay = [s for s in scored if 40 <= s.overall_score < 55]
    fun = [s for s in scored if s.overall_score >= 70]

    if fun:
        suggestions.append(
            f"🎉 {len(fun)} activities are super fun for kids: "
            + ", ".join(s.name for s in fun[:3])
        )
    if boring:
        suggestions.append(
            f"😴 {len(boring)} activities might bore kids: "
            + ", ".join(s.name for s in boring[:3])
        )
        suggestions.append(
            "💡 Click \"Make it Fun!\" to get kid-friendly alternatives."
        )
    if okay:
        suggestions.append(
            f"👍 {len(okay)} activities are okay but could be more fun."
        )

    suggestions.append("🍦 Don't forget snack breaks every 1-2 hours!")
    suggestions.append("🧴 Pack sunscreen, hats, and water for outdoor activities.")
    suggestions.append("📱 Download offline games and movies for travel segments.")

    overall_score = round(
        sum(s.overall_score for s in scored) / len(scored), 1
    ) if scored else 0

    # Get destination-specific kid activity suggestions
    kid_suggestions = get_kid_suggestions(req.destination)

    logger.info(f"Child optimization complete: {len(scored)} activities, overall={overall_score}")

    return {
        "destination": req.destination,
        "scored_activities": [s.model_dump() for s in scored],
        "suggestions": suggestions,
        "overall_child_score": overall_score,
        "kid_activity_suggestions": kid_suggestions,
    }
