"""
Venue discovery service using Mapbox Geocoding API (POI search).
Replaces deprecated Foursquare Places API v3.
Searches for nearby venues (hotels, restaurants, attractions) using Mapbox's POI geocoding.
"""

import logging
import os
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places"

# Category search queries for Mapbox POI lookup
CATEGORY_MAP = {
    "hotels": "hotel,resort,lodge,inn,motel",
    "restaurants": "restaurant,food,dining,biryani,dosa",
    "cafes": "cafe,coffee,tea",
    "attractions": "temple,monument,park,museum,landmark,fort,beach,palace",
    "temples": "temple,church,mosque,shrine",
    "parks": "park,garden",
    "museums": "museum,gallery",
    "shopping": "mall,market,shop",
    "nightlife": "bar,pub,nightclub",
}


def _get_mapbox_token() -> Optional[str]:
    return os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv("VITE_MAPBOX_ACCESS_TOKEN")


async def search_places(
    query: Optional[str] = None,
    near: str = "",
    categories: Optional[str] = None,
    limit: int = 5,
    radius: int = 10000,
    sort: str = "RELEVANCE",
) -> list[dict]:
    """
    Search for places using Mapbox Geocoding API.

    Args:
        query: Free-text search query (e.g. "temple", "beach restaurant")
        near: Location string (e.g. "Kanyakumari, India")
        categories: Category key from CATEGORY_MAP (e.g. "hotels")
        limit: Max results (1-10)
        radius: Not used directly by Mapbox, but affects proximity bias

    Returns:
        List of venue dicts with name, address, coordinates, etc.
    """
    token = _get_mapbox_token()
    if not token:
        logger.warning("MAPBOX_ACCESS_TOKEN not set — returning empty results")
        return []

    # Build search query
    search_text = query or categories or "restaurant"

    # First geocode the "near" location to get a proximity bias
    proximity = None
    if near:
        geo = await _geocode_location(near, token)
        if geo:
            proximity = geo

    params: dict = {
        "access_token": token,
        "types": "poi",
        "limit": str(min(limit, 10)),  # Mapbox limit is 10
        "language": "en",
    }
    if proximity:
        params["proximity"] = f"{proximity['lng']},{proximity['lat']}"

    url = f"{MAPBOX_BASE}/{search_text}.json"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            logger.info(f"Mapbox POI returned {len(features)} results for '{search_text}' near '{near}'")
            return _format_results(features)
        except httpx.HTTPStatusError as e:
            logger.error(f"Mapbox POI error {e.response.status_code}: {e.response.text[:200]}")
            return []
        except Exception as e:
            logger.error(f"Mapbox POI request failed: {e}")
            return []


async def _geocode_location(place: str, token: str) -> Optional[dict]:
    """Quick geocode to get lat/lng for proximity bias."""
    url = f"{MAPBOX_BASE}/{place}.json"
    params = {"access_token": token, "limit": "1", "types": "place,locality,region"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                lng, lat = features[0]["center"]
                return {"lat": lat, "lng": lng}
            return None
        except Exception:
            return None


def _format_results(features: list[dict]) -> list[dict]:
    """Format Mapbox geocoding features into a cleaner venue structure."""
    formatted = []
    for f in features:
        props = f.get("properties", {})
        context = f.get("context", [])
        center = f.get("center", [0, 0])

        # Extract locality from context
        locality = ""
        region = ""
        for ctx in context:
            ctx_id = ctx.get("id", "")
            if ctx_id.startswith("place"):
                locality = ctx.get("text", "")
            elif ctx_id.startswith("region"):
                region = ctx.get("text", "")

        # Determine category from Mapbox POI category array
        categories = props.get("category", "").split(", ") if props.get("category") else []
        primary_cat = categories[0] if categories else f.get("text", "Place")

        formatted.append({
            "fsq_id": f.get("id", ""),  # keep same key name for frontend compat
            "name": f.get("text", "Unknown"),
            "address": f.get("place_name", ""),
            "locality": locality,
            "region": region,
            "country": "",
            "latitude": center[1] if len(center) > 1 else None,
            "longitude": center[0] if len(center) > 0 else None,
            "category": primary_cat,
            "category_icon": None,
            "rating": None,  # Mapbox doesn't provide ratings
            "price": None,
            "photo_url": None,
            "tip": None,
            "website": None,
            "phone": None,
            "source": "mapbox",
        })
    return formatted


def resolve_categories(category_names: list[str]) -> str:
    """Convert human-readable category names to search queries."""
    queries = []
    for name in category_names:
        q = CATEGORY_MAP.get(name.lower().strip())
        if q:
            queries.append(q)
    return ",".join(queries)
