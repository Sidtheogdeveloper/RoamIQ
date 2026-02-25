"""
Elderly-friendly scoring logic.

Scores activities/venues for elderly suitability based on:
  - Crowd level (lower = better)
  - Walking/physical demand (lower = better, uses distance_km & estimated_steps)
  - Indoor preference (indoor = better)
  - Duration (shorter = better for fatigue)
"""

import logging
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class VenueScore(BaseModel):
    name: str
    crowd_score: float       # 0-100, higher = more elderly-friendly (less crowded)
    walkability_score: float  # 0-100, higher = less walking required
    accessibility_score: float  # 0-100, higher = more accessible
    overall_score: float      # 0-100, weighted combination
    recommendation: str       # "Highly Recommended", "Suitable", "Use Caution", "Not Recommended"
    reasons: list[str]        # Explanation bullets


# Activities/types that typically require less physical effort
LOW_EFFORT_TYPES = {
    "museum", "cafe", "restaurant", "theater", "cinema", "library",
    "gallery", "spa", "temple", "church", "cathedral", "mall",
    "shopping_mall", "bakery", "tea_house", "hotel",
}

# Activities that typically require significant walking/effort
HIGH_EFFORT_TYPES = {
    "hiking", "trek", "trail", "mountain", "waterfall", "adventure",
    "sports", "cycling", "surfing", "diving", "climbing", "waterpark",
    "amusement_park", "theme_park", "zoo",
}

# Keywords that suggest high physical demand
HIGH_EFFORT_KEYWORDS = [
    "hike", "trek", "climb", "stairs", "steep", "walk", "trail",
    "uphill", "adventure", "sport", "cycling", "surf",
]


def compute_crowd_score(busyness_pct: Optional[float]) -> float:
    """Convert busyness percentage to elderly-friendly score (lower crowd = higher score)."""
    if busyness_pct is None:
        return 50.0  # neutral if unknown
    return max(0, min(100, 100 - busyness_pct))


def estimate_steps_from_duration(
    duration_minutes: Optional[int],
    is_outdoor: bool = False,
    venue_type: Optional[str] = None,
) -> int:
    """Estimate walking steps from duration and activity type.
    Average elderly walking: ~70 steps/min outdoors, ~30 steps/min indoors.
    """
    if not duration_minutes:
        return 0

    # Determine walking rate based on activity context
    if venue_type:
        vtype = venue_type.lower()
        if any(t in vtype for t in HIGH_EFFORT_TYPES):
            steps_per_min = 90  # hiking, trekking etc.
        elif any(t in vtype for t in LOW_EFFORT_TYPES):
            steps_per_min = 20  # seated activities
        elif is_outdoor:
            steps_per_min = 70
        else:
            steps_per_min = 30
    elif is_outdoor:
        steps_per_min = 70
    else:
        steps_per_min = 30

    return int(duration_minutes * steps_per_min)


def estimate_distance_from_duration(
    duration_minutes: Optional[int],
    is_outdoor: bool = False,
    venue_type: Optional[str] = None,
) -> float:
    """Estimate distance in km from duration and type.
    Elderly walking speed: ~3.5 km/h outdoors, ~1.5 km/h indoor browsing.
    """
    if not duration_minutes:
        return 0.0

    hours = duration_minutes / 60.0

    if venue_type:
        vtype = venue_type.lower()
        if any(t in vtype for t in HIGH_EFFORT_TYPES):
            km_per_hour = 3.5  # active outdoor
        elif any(t in vtype for t in LOW_EFFORT_TYPES):
            km_per_hour = 0.5  # mostly seated
        elif is_outdoor:
            km_per_hour = 3.0
        else:
            km_per_hour = 1.5
    elif is_outdoor:
        km_per_hour = 3.0
    else:
        km_per_hour = 1.5

    return round(hours * km_per_hour, 2)


def compute_walkability_score(
    is_outdoor: bool = False,
    duration_minutes: Optional[int] = None,
    venue_type: Optional[str] = None,
    description: Optional[str] = None,
    distance_km: Optional[float] = None,
    estimated_steps: Optional[int] = None,
) -> float:
    """Score based on physical demand. Higher = less walking needed.
    Uses distance_km and estimated_steps for data-driven scoring when available.
    """
    score = 70.0  # default neutral-good

    # ── Distance-based penalties (most reliable signal) ──
    if distance_km is not None and distance_km > 0:
        if distance_km > 5:
            score -= 35
        elif distance_km > 3:
            score -= 25
        elif distance_km > 2:
            score -= 15
        elif distance_km > 1:
            score -= 8

    # ── Steps-based penalties ──
    if estimated_steps is not None and estimated_steps > 0:
        if estimated_steps > 8000:
            score -= 35
        elif estimated_steps > 5000:
            score -= 20
        elif estimated_steps > 3000:
            score -= 10
        elif estimated_steps > 1500:
            score -= 5

    # ── Indoor vs outdoor ──
    if is_outdoor:
        score -= 10

    # ── Duration penalty (longer = more tiring) ──
    if duration_minutes:
        if duration_minutes > 180:
            score -= 20
        elif duration_minutes > 120:
            score -= 12
        elif duration_minutes > 60:
            score -= 5

    # ── Type-based adjustments ──
    if venue_type:
        vtype = venue_type.lower()
        if any(t in vtype for t in HIGH_EFFORT_TYPES):
            score -= 25
        elif any(t in vtype for t in LOW_EFFORT_TYPES):
            score += 15

    # ── Description keyword scan ──
    if description:
        desc_lower = description.lower()
        effort_hits = sum(1 for kw in HIGH_EFFORT_KEYWORDS if kw in desc_lower)
        score -= effort_hits * 8

    return max(0, min(100, score))


def compute_accessibility_score(
    is_indoor: bool = True,
    venue_type: Optional[str] = None,
    has_seating: bool = True,
) -> float:
    """Score based on accessibility features."""
    score = 60.0

    if is_indoor:
        score += 20
    if has_seating:
        score += 10
    if venue_type and venue_type.lower() in LOW_EFFORT_TYPES:
        score += 10

    return max(0, min(100, score))


def score_venue_for_elderly(
    name: str,
    busyness_pct: Optional[float] = None,
    is_outdoor: bool = False,
    duration_minutes: Optional[int] = None,
    venue_type: Optional[str] = None,
    description: Optional[str] = None,
    has_seating: bool = True,
    distance_km: Optional[float] = None,
    estimated_steps: Optional[int] = None,
) -> VenueScore:
    """Compute overall elderly-friendly score for a venue/activity."""

    # Auto-estimate distance and steps if not provided
    if distance_km is None:
        distance_km = estimate_distance_from_duration(duration_minutes, is_outdoor, venue_type)
    if estimated_steps is None:
        estimated_steps = estimate_steps_from_duration(duration_minutes, is_outdoor, venue_type)

    crowd = compute_crowd_score(busyness_pct)
    walk = compute_walkability_score(
        is_outdoor, duration_minutes, venue_type, description,
        distance_km, estimated_steps,
    )
    access = compute_accessibility_score(not is_outdoor, venue_type, has_seating)

    # Weighted: crowd matters most for elderly, then walkability
    overall = (crowd * 0.35) + (walk * 0.40) + (access * 0.25)

    # Generate detailed reasons
    reasons = []

    # Crowd reasons
    if busyness_pct is not None:
        if crowd >= 70:
            reasons.append("Low crowd levels — comfortable for elderly visitors")
        elif crowd <= 30:
            reasons.append("⚠️ High crowd levels — may be uncomfortable")
        else:
            reasons.append(f"Moderate crowd levels ({round(busyness_pct)}% busy)")
    else:
        reasons.append("ℹ️ Crowd data unavailable — score is estimated")

    # Walkability reasons with actual numbers
    if estimated_steps > 0:
        if estimated_steps > 6000:
            reasons.append(f"⚠️ ~{estimated_steps:,} steps estimated — plan rest breaks and consider taxi")
        elif estimated_steps > 3000:
            reasons.append(f"~{estimated_steps:,} steps — moderate walking involved")
        else:
            reasons.append(f"~{estimated_steps:,} steps — light walking")

    if distance_km > 0:
        if distance_km > 3:
            reasons.append(f"⚠️ ~{distance_km:.1f} km distance — consider taxi or auto-rickshaw")
        elif distance_km > 1:
            reasons.append(f"~{distance_km:.1f} km — manageable walking distance")

    if walk >= 70:
        reasons.append("Minimal physical effort required")
    elif walk <= 40:
        reasons.append("⚠️ Significant physical effort needed")

    if not is_outdoor:
        reasons.append("Indoor venue — weather-protected")
    else:
        reasons.append("Outdoor venue — check weather conditions")

    if duration_minutes and duration_minutes > 120:
        reasons.append(f"⚠️ Long duration ({duration_minutes} min) — plan rest breaks")

    # Recommendation tier
    if overall >= 75:
        rec = "Highly Recommended"
    elif overall >= 55:
        rec = "Suitable"
    elif overall >= 35:
        rec = "Use Caution"
    else:
        rec = "Not Recommended"

    logger.debug(
        f"Scored '{name}': crowd={crowd:.0f}, walk={walk:.0f}, access={access:.0f}, "
        f"overall={overall:.0f}, steps={estimated_steps}, dist={distance_km:.1f}km"
    )

    return VenueScore(
        name=name,
        crowd_score=round(crowd, 1),
        walkability_score=round(walk, 1),
        accessibility_score=round(access, 1),
        overall_score=round(overall, 1),
        recommendation=rec,
        reasons=reasons,
    )


def rank_activities_for_elderly(activities: list[dict]) -> list[VenueScore]:
    """Score and rank a list of activities for elderly suitability."""
    scored = [
        score_venue_for_elderly(
            name=a.get("name") or a.get("title", "Unknown"),
            busyness_pct=a.get("busyness_pct"),
            is_outdoor=a.get("is_outdoor", False),
            duration_minutes=a.get("duration_minutes"),
            venue_type=a.get("type") or a.get("category"),
            description=a.get("description"),
            has_seating=a.get("has_seating", True),
            distance_km=a.get("distance_km"),
            estimated_steps=a.get("estimated_steps"),
        )
        for a in activities
    ]
    scored.sort(key=lambda v: v.overall_score, reverse=True)
    return scored
