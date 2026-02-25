"""
Child-friendly scoring logic.

Scores activities/venues for child suitability based on:
  - Fun factor (interactive, playful, exciting)
  - Safety (indoor, low-effort, supervised)
  - Engagement (age-appropriate, educational)
  - Duration (shorter = better for kids' attention span)

Also suggests kid-friendly alternatives for adult-oriented activities.
"""

import logging
from typing import Optional, Tuple
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ChildScore(BaseModel):
    name: str
    fun_score: float          # 0-100, higher = more fun for kids
    safety_score: float       # 0-100, higher = safer
    engagement_score: float   # 0-100, higher = more engaging
    overall_score: float      # 0-100, weighted combination
    recommendation: str       # "Super Fun!", "Good for Kids", "Okay", "Not for Kids"
    emoji: str                # Activity emoji
    reasons: list[str]
    suggested_alternative: Optional[str] = None  # kid-friendly replacement if score is low


# ── Kid-friendly activity types ──────────────────────────────
KID_FRIENDLY_TYPES = {
    "amusement_park", "theme_park", "zoo", "aquarium", "playground",
    "park", "water_park", "waterpark", "beach", "ice_cream",
    "toy_store", "carnival", "circus", "bowling", "arcade",
    "trampoline", "museum", "science_center", "planetarium",
}

# Activities kids especially love
SUPER_FUN_KEYWORDS = [
    "amusement", "theme park", "roller coaster", "water slide",
    "zoo", "aquarium", "playground", "trampoline", "carnival",
    "magic show", "puppet", "cartoon", "toy", "candy",
    "ice cream", "chocolate", "fun", "adventure park", "splash",
    "go kart", "bumper car", "ferris wheel", "merry-go-round",
    "arcade", "gaming", "laser tag", "mini golf", "bowling",
]

# Activities that might bore kids
BORING_FOR_KIDS_KEYWORDS = [
    "wine", "bar", "pub", "nightclub", "brewery", "cocktail",
    "spa", "massage", "meditation", "yoga retreat",
    "business", "conference", "seminar", "workshop",
    "art gallery", "antique", "heritage walk",
]

# Activities that could be risky for kids
RISKY_FOR_KIDS_KEYWORDS = [
    "bungee", "paragliding", "scuba", "deep sea",
    "rock climbing", "cliff", "white water", "rapids",
    "skydiving", "zip line", "mountaineering",
]

# Kid-friendly alternatives by activity type
_ALTERNATIVES: dict[str, list[str]] = {
    "temple": [
        "🎨 Visit a children's art workshop nearby",
        "🌳 Explore the temple gardens and feed birds",
    ],
    "monument": [
        "🏰 Take a treasure hunt tour of the monument",
        "📸 Fun photo scavenger hunt around the site",
    ],
    "restaurant": [
        "🍦 Find a kid-friendly cafe with ice cream and games",
        "🎪 Look for a themed restaurant with play area",
    ],
    "market": [
        "🎈 Visit the toy section or balloon vendors",
        "🍬 Explore candy and snack stalls together",
    ],
    "museum": [
        "🔬 Check if there's a kids' interactive science section",
        "🎮 Look for hands-on exhibits and activity zones",
    ],
    "beach": [
        "🏖️ Build sandcastles and collect seashells",
        "🪁 Fly kites and play beach games",
    ],
    "viewpoint": [
        "🔭 Bring binoculars for a fun spotting game",
        "📷 Photo challenge — who spots the coolest thing?",
    ],
    "station": [
        "🚂 Watch trains and play the train-spotting game",
        "📚 Bring activity books for the journey",
    ],
    "hotel": [
        "🏊 Check if the hotel has a pool or play area",
        "🎲 Board games and indoor fun at the hotel",
    ],
}

# Emoji mapping by venue type
_VENUE_EMOJIS: dict[str, str] = {
    "beach": "🏖️", "temple": "🛕", "restaurant": "🍽️",
    "station": "🚂", "hotel": "🏨", "monument": "🏛️",
    "park": "🌳", "market": "🛍️", "viewpoint": "📸",
    "waterfall": "🌊", "zoo": "🦁", "aquarium": "🐠",
    "amusement_park": "🎢", "theme_park": "🎡", "museum": "🏛️",
    "playground": "🛝", "cinema": "🎬", "attraction": "⭐",
}


def _classify_for_kids(title: str, description: Optional[str] = None) -> str:
    """Classify activity type for kid scoring."""
    text = f"{title} {description or ''}".lower()
    for venue_type in KID_FRIENDLY_TYPES:
        if venue_type.replace("_", " ") in text or venue_type in text:
            return venue_type

    # Check broader patterns
    patterns = [
        ("beach", ["beach", "shore", "coast", "seaside"]),
        ("temple", ["temple", "mandir", "church", "mosque", "shrine"]),
        ("restaurant", ["restaurant", "cafe", "food", "breakfast", "lunch", "dinner", "dosa", "biryani"]),
        ("station", ["railway", "station", "bus stand", "airport", "departure", "arrival"]),
        ("hotel", ["hotel", "resort", "check-in", "lodge", "stay"]),
        ("monument", ["fort", "palace", "memorial", "tomb"]),
        ("park", ["park", "garden", "botanical"]),
        ("market", ["market", "bazaar", "shopping", "mall"]),
        ("viewpoint", ["viewpoint", "sunset", "sunrise", "scenic", "lookout"]),
        ("waterfall", ["waterfall", "falls", "dam", "lake"]),
    ]
    for vtype, keywords in patterns:
        for kw in keywords:
            if kw in text:
                return vtype
    return "attraction"


def score_activity_for_child(
    name: str,
    description: Optional[str] = None,
    is_outdoor: bool = False,
    duration_minutes: Optional[int] = None,
    venue_type: Optional[str] = None,
) -> ChildScore:
    """Score an activity for child-friendliness."""
    text = f"{name} {description or ''}".lower()
    vtype = venue_type or _classify_for_kids(name, description)
    emoji = _VENUE_EMOJIS.get(vtype, "⭐")

    # ── Fun Score ──
    fun = 50.0
    super_fun_hits = sum(1 for kw in SUPER_FUN_KEYWORDS if kw in text)
    fun += super_fun_hits * 12
    boring_hits = sum(1 for kw in BORING_FOR_KIDS_KEYWORDS if kw in text)
    fun -= boring_hits * 15

    if vtype in KID_FRIENDLY_TYPES:
        fun += 20
    if is_outdoor:
        fun += 5  # kids love outdoors
    if duration_minutes and duration_minutes <= 60:
        fun += 5  # short activities are good for attention span
    elif duration_minutes and duration_minutes > 120:
        fun -= 10

    fun = max(0, min(100, fun))

    # ── Safety Score ──
    safety = 70.0
    risky_hits = sum(1 for kw in RISKY_FOR_KIDS_KEYWORDS if kw in text)
    safety -= risky_hits * 20
    if not is_outdoor:
        safety += 10
    if vtype in {"restaurant", "hotel", "museum", "cinema", "mall"}:
        safety += 10
    if vtype in {"beach", "waterfall", "viewpoint"}:
        safety -= 5  # need supervision

    safety = max(0, min(100, safety))

    # ── Engagement Score ──
    engagement = 50.0
    if vtype in {"zoo", "aquarium", "amusement_park", "theme_park", "playground", "museum"}:
        engagement += 30
    elif vtype in {"park", "beach"}:
        engagement += 15
    elif vtype in {"temple", "monument"}:
        engagement -= 5  # might be boring
    if super_fun_hits > 0:
        engagement += 15
    if boring_hits > 0:
        engagement -= 20

    engagement = max(0, min(100, engagement))

    # ── Overall Score ──
    overall = (fun * 0.45) + (safety * 0.25) + (engagement * 0.30)
    overall = max(0, min(100, overall))

    # ── Reasons ──
    reasons = []
    if fun >= 70:
        reasons.append("🎉 Kids will love this activity!")
    elif fun >= 50:
        reasons.append("👍 Decent fun level for children")
    elif fun < 30:
        reasons.append("😴 Might not hold kids' interest")

    if safety >= 70:
        reasons.append("✅ Safe environment for children")
    elif safety < 50:
        reasons.append("⚠️ Extra supervision needed for kids")

    if risky_hits > 0:
        reasons.append("🚫 May have age restrictions — verify before booking")

    if duration_minutes:
        if duration_minutes > 120:
            reasons.append(f"⏰ Long duration ({duration_minutes} min) — pack snacks and activities")
        elif duration_minutes <= 45:
            reasons.append(f"⚡ Perfect duration for kids' attention span")

    if is_outdoor:
        reasons.append("☀️ Outdoor — bring sunscreen, hats, and water")

    # ── Recommendation tier ──
    if overall >= 75:
        rec = "Super Fun!"
        emoji = "🌟"
    elif overall >= 55:
        rec = "Good for Kids"
    elif overall >= 35:
        rec = "Okay"
    else:
        rec = "Not for Kids"

    # ── Suggest alternative if low score ──
    alternative = None
    if overall < 55:
        alts = _ALTERNATIVES.get(vtype, [
            f"🎪 Find a kid-friendly attraction near {name}",
            "🎨 Look for interactive workshops or play areas nearby",
        ])
        alternative = alts[0] if alts else None

    return ChildScore(
        name=name,
        fun_score=round(fun, 1),
        safety_score=round(safety, 1),
        engagement_score=round(engagement, 1),
        overall_score=round(overall, 1),
        recommendation=rec,
        emoji=emoji,
        reasons=reasons,
        suggested_alternative=alternative,
    )


def rank_activities_for_children(activities: list[dict]) -> list[ChildScore]:
    """Score and rank activities for child suitability."""
    scored = [
        score_activity_for_child(
            name=a.get("name") or a.get("title", "Unknown"),
            description=a.get("description"),
            is_outdoor=a.get("is_outdoor", False),
            duration_minutes=a.get("duration_minutes"),
            venue_type=a.get("type") or a.get("category"),
        )
        for a in activities
    ]
    scored.sort(key=lambda v: v.overall_score, reverse=True)
    return scored


# ── Kid-friendly destination suggestions ─────────────────────
_KID_DESTINATION_SUGGESTIONS: dict[str, list[dict]] = {
    "default": [
        {"title": "🎢 Visit an Amusement Park", "description": "Thrilling rides and games for the whole family!", "duration": "3-4 hours", "category": "amusement_park"},
        {"title": "🦁 Explore the Local Zoo", "description": "Meet amazing animals up close!", "duration": "2-3 hours", "category": "zoo"},
        {"title": "🍦 Ice Cream Parlor Hop", "description": "Try the best ice cream spots in town!", "duration": "1 hour", "category": "restaurant"},
        {"title": "🏖️ Beach Fun Day", "description": "Sandcastles, splash time, and beach games!", "duration": "2-3 hours", "category": "beach"},
        {"title": "🎨 Kids Art Workshop", "description": "Painting, clay, and creative fun!", "duration": "1-2 hours", "category": "attraction"},
        {"title": "🌳 Park Picnic & Playground", "description": "Pack snacks and enjoy the outdoors!", "duration": "1-2 hours", "category": "park"},
    ],
}


def get_kid_suggestions(destination: str) -> list[dict]:
    """Get kid-friendly activity suggestions for a destination."""
    suggestions = _KID_DESTINATION_SUGGESTIONS.get(
        destination.lower(),
        _KID_DESTINATION_SUGGESTIONS["default"],
    )
    return suggestions
