"""
Crowd Predictor — generates estimated busyness levels when BestTime API
returns no data.  Uses venue-type classification, time-of-day curves,
and day-of-week modifiers to produce realistic predictions.
"""

import re
from typing import Optional, Tuple

# ── Venue type keywords ────────────────────────────────────────
_VENUE_PATTERNS: list[Tuple[str, list[str]]] = [
    ("beach",       ["beach", "shore", "coast", "seaside", "marina"]),
    ("temple",      ["temple", "mandir", "kovil", "church", "mosque", "shrine", "cathedral", "basilica"]),
    ("restaurant",  ["restaurant", "cafe", "dine", "dining", "food", "eat", "breakfast", "lunch", "dinner", "biryani", "dosa", "tiffin", "mess", "hotel"]),
    ("station",     ["railway", "station", "junction", "bus stand", "airport", "terminal", "departure", "arrival"]),
    ("hotel",       ["hotel", "resort", "check-in", "check-out", "accommodation", "stay", "lodge", "inn"]),
    ("monument",    ["fort", "palace", "monument", "memorial", "museum", "gallery", "tomb", "mausoleum"]),
    ("park",        ["park", "garden", "botanical", "zoo", "wildlife", "sanctuary", "reserve"]),
    ("market",      ["market", "bazaar", "shopping", "mall", "shop", "souvenir", "store"]),
    ("viewpoint",   ["viewpoint", "view point", "sunset", "sunrise", "scenic", "lookout", "tip", "cape", "point"]),
    ("waterfall",   ["waterfall", "falls", "dam", "lake", "river", "backwater"]),
    ("attraction",  ["attraction", "tour", "sightseeing", "explore", "visit"]),
]

# ── Hourly busyness curves (0-23h) per venue type ─────────────
# Values are base busyness percentages (0-100)
_HOURLY_CURVES: dict[str, list[int]] = {
    "beach": [
        5, 3, 2, 2, 3, 10, 25, 35, 40, 35, 30, 25,
        20, 25, 30, 40, 55, 75, 85, 60, 35, 20, 10, 5
    ],
    "temple": [
        5, 3, 2, 2, 5, 30, 65, 70, 55, 40, 30, 25,
        20, 15, 15, 20, 35, 60, 70, 55, 35, 20, 10, 5
    ],
    "restaurant": [
        3, 2, 2, 2, 2, 5, 15, 45, 65, 50, 30, 25,
        50, 70, 55, 30, 20, 25, 45, 70, 75, 60, 35, 15
    ],
    "station": [
        20, 15, 10, 10, 15, 30, 55, 70, 75, 60, 45, 40,
        40, 45, 50, 55, 65, 75, 80, 70, 55, 45, 35, 25
    ],
    "hotel": [
        10, 5, 3, 3, 5, 10, 20, 35, 50, 55, 60, 55,
        50, 50, 55, 55, 50, 45, 40, 35, 30, 25, 20, 15
    ],
    "monument": [
        3, 2, 2, 2, 3, 5, 10, 20, 35, 50, 65, 70,
        55, 45, 50, 55, 60, 55, 40, 25, 15, 10, 5, 3
    ],
    "park": [
        3, 2, 2, 2, 5, 15, 35, 50, 55, 50, 45, 40,
        35, 30, 35, 45, 55, 65, 60, 40, 25, 15, 8, 5
    ],
    "market": [
        2, 2, 2, 2, 3, 5, 10, 20, 35, 50, 65, 70,
        60, 55, 55, 60, 70, 75, 70, 55, 40, 25, 15, 5
    ],
    "viewpoint": [
        10, 5, 3, 3, 5, 30, 55, 45, 35, 30, 25, 25,
        25, 25, 30, 40, 55, 75, 85, 60, 30, 15, 10, 8
    ],
    "waterfall": [
        3, 2, 2, 2, 3, 5, 15, 25, 40, 55, 65, 70,
        60, 50, 50, 55, 55, 45, 30, 20, 10, 5, 3, 3
    ],
    "attraction": [
        3, 2, 2, 2, 3, 5, 15, 25, 40, 55, 65, 70,
        60, 55, 55, 60, 60, 55, 40, 30, 20, 10, 5, 3
    ],
}

# Default curve for unclassified venues
_DEFAULT_CURVE = [
    5, 3, 3, 3, 5, 10, 20, 35, 45, 55, 60, 65,
    55, 50, 50, 55, 60, 60, 50, 40, 30, 20, 10, 5
]

# Day-of-week multipliers (Mon=0 .. Sun=6)
# Tourist spots are busier on weekends & holidays
_DAY_MULTIPLIERS = [0.80, 0.80, 0.85, 0.90, 0.95, 1.15, 1.20]


def classify_venue(title: str, location: Optional[str] = None) -> str:
    """Classify a venue into a type based on title and location keywords."""
    text = f"{title} {location or ''}".lower()
    for venue_type, keywords in _VENUE_PATTERNS:
        for kw in keywords:
            if kw in text:
                return venue_type
    return "attraction"  # fallback


def predict_busyness(
    title: str,
    location: Optional[str] = None,
    hour: Optional[int] = None,
    day_of_week: Optional[int] = None,
) -> Tuple[int, str, str]:
    """
    Predict crowd busyness for a venue.

    Returns:
        (busyness_pct, optimization_tip, venue_type)
    """
    venue_type = classify_venue(title, location)
    curve = _HOURLY_CURVES.get(venue_type, _DEFAULT_CURVE)

    # Get base busyness from time curve
    if hour is not None and 0 <= hour <= 23:
        base = curve[hour]
    else:
        # No time specified — use the average of the curve
        base = round(sum(curve) / len(curve))

    # Apply day-of-week modifier
    if day_of_week is not None and 0 <= day_of_week <= 6:
        base = round(base * _DAY_MULTIPLIERS[day_of_week])

    # Clamp to 0-100
    busyness = max(0, min(100, base))

    # Generate optimization tip
    if busyness > 80:
        tip = f"🔴 Predicted very crowded! Consider visiting at a quieter hour."
    elif busyness > 60:
        tip = f"🟡 Expected to be moderately busy. Plan extra time."
    elif busyness > 30:
        tip = f"🟢 Predicted reasonable crowd levels for this time."
    else:
        tip = f"✅ Predicted to be quiet — great time to visit!"

    # Add venue-specific suggestion
    if venue_type == "beach" and hour is not None:
        if 16 <= hour <= 19:
            tip += " 🌅 Popular sunset hours at the beach."
        elif 5 <= hour <= 7:
            tip += " 🌅 Great time for a peaceful sunrise walk."
    elif venue_type == "temple" and hour is not None:
        if 5 <= hour <= 8:
            tip += " 🛕 Morning prayers tend to draw crowds."
        elif 17 <= hour <= 19:
            tip += " 🛕 Evening aarti/prayer rush expected."
    elif venue_type == "restaurant" and hour is not None:
        if hour in (7, 8, 9):
            tip += " 🍳 Peak breakfast hours."
        elif hour in (12, 13, 14):
            tip += " 🍽️ Lunch rush expected."
        elif hour in (19, 20, 21):
            tip += " 🍽️ Dinner rush expected."
    elif venue_type == "viewpoint" and hour is not None:
        if 16 <= hour <= 19:
            tip += " 📸 Sunset viewing — arrive early for best spots."

    return busyness, tip, venue_type
