"""
Route-based venue discovery.

1. Geocodes source + destination using Mapbox Geocoding API
2. Gets driving route via Mapbox Directions API
3. Samples points along the route polyline
4. Searches Foursquare at each sampled point for hotels/restaurants
5. Deduplicates and returns venues with route position info
"""

import logging
import math
import os
from typing import Optional
import httpx

from services.foursquare import search_places, CATEGORY_MAP

logger = logging.getLogger(__name__)

MAPBOX_BASE = "https://api.mapbox.com"


def _get_mapbox_token() -> Optional[str]:
    return os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv("VITE_MAPBOX_ACCESS_TOKEN")


async def geocode_place(place: str) -> Optional[dict]:
    """Geocode a place name to lat/lng using Mapbox."""
    token = _get_mapbox_token()
    if not token:
        logger.error("No Mapbox token configured")
        return None

    url = f"{MAPBOX_BASE}/geocoding/v5/mapbox.places/{place}.json"
    params = {"access_token": token, "limit": "1", "types": "place,region,country,locality"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                lng, lat = features[0]["center"]
                return {"lat": lat, "lng": lng, "name": features[0].get("place_name", place)}
            return None
        except Exception as e:
            logger.error(f"Geocoding failed for '{place}': {e}")
            return None


async def get_route(origin_lng: float, origin_lat: float, dest_lng: float, dest_lat: float) -> Optional[list]:
    """Get driving route coordinates from Mapbox Directions API."""
    token = _get_mapbox_token()
    if not token:
        return None

    url = f"{MAPBOX_BASE}/directions/v5/mapbox/driving/{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    params = {
        "access_token": token,
        "geometries": "geojson",
        "overview": "full",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            routes = data.get("routes", [])
            if routes:
                coords = routes[0]["geometry"]["coordinates"]  # [[lng, lat], ...]
                distance_km = routes[0]["distance"] / 1000
                duration_min = routes[0]["duration"] / 60
                logger.info(f"Route: {distance_km:.0f} km, {duration_min:.0f} min, {len(coords)} points")
                return coords
            return None
        except Exception as e:
            logger.error(f"Directions API failed: {e}")
            return None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two lat/lng points in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def sample_points_along_route(coords: list, interval_km: float = 50.0) -> list[dict]:
    """
    Sample points along a route polyline at regular intervals.
    Returns list of {lat, lng, distance_km} dicts.
    """
    if not coords or len(coords) < 2:
        return []

    points = []
    accumulated_km = 0.0

    # Always include the start
    points.append({"lat": coords[0][1], "lng": coords[0][0], "distance_km": 0})

    for i in range(1, len(coords)):
        prev_lng, prev_lat = coords[i - 1]
        curr_lng, curr_lat = coords[i]
        segment_km = _haversine_km(prev_lat, prev_lng, curr_lat, curr_lng)
        accumulated_km += segment_km

        if accumulated_km >= interval_km * len(points):
            points.append({"lat": curr_lat, "lng": curr_lng, "distance_km": round(accumulated_km, 1)})

    # Always include the end
    end_lat, end_lng = coords[-1][1], coords[-1][0]
    if len(points) < 2 or _haversine_km(points[-1]["lat"], points[-1]["lng"], end_lat, end_lng) > 5:
        points.append({"lat": end_lat, "lng": end_lng, "distance_km": round(accumulated_km, 1)})

    return points


async def search_venues_along_route(
    source: str,
    destination: str,
    categories: list[str],
    interval_km: float = 50.0,
    limit_per_point: int = 3,
) -> dict:
    """
    Full pipeline: geocode → route → sample → Foursquare search at each point.
    Returns venues grouped by category with route position info.
    """
    # Step 1: Geocode source and destination
    src_geo = await geocode_place(source)
    dst_geo = await geocode_place(destination)

    if not src_geo:
        logger.error(f"Could not geocode source: {source}")
        return {"error": f"Could not geocode source city: {source}", "results": {}}
    if not dst_geo:
        logger.error(f"Could not geocode destination: {destination}")
        return {"error": f"Could not geocode destination: {destination}", "results": {}}

    logger.info(f"Route: {src_geo['name']} → {dst_geo['name']}")

    # Step 2: Get driving route
    route_coords = await get_route(src_geo["lng"], src_geo["lat"], dst_geo["lng"], dst_geo["lat"])
    if not route_coords:
        logger.warning("No route found, falling back to endpoint-only search")
        route_coords = [[src_geo["lng"], src_geo["lat"]], [dst_geo["lng"], dst_geo["lat"]]]

    # Step 3: Sample points along the route
    total_distance = sum(
        _haversine_km(route_coords[i][1], route_coords[i][0], route_coords[i + 1][1], route_coords[i + 1][0])
        for i in range(len(route_coords) - 1)
    )

    # Adjust interval based on total distance
    if total_distance < 50:
        sample_interval = max(10, total_distance / 3)
    elif total_distance < 200:
        sample_interval = 40
    else:
        sample_interval = min(interval_km, total_distance / 5)

    sampled = sample_points_along_route(route_coords, sample_interval)
    logger.info(f"Route {total_distance:.0f} km — sampled {len(sampled)} points at {sample_interval:.0f} km intervals")

    # Step 4: Search Foursquare at each sampled point
    all_results: dict[str, list[dict]] = {cat: [] for cat in categories}
    seen_ids: set[str] = set()

    for cat_name in categories:
        cat_id = CATEGORY_MAP.get(cat_name.lower())
        if not cat_id:
            continue

        for pt in sampled:
            venues = await _search_at_point(
                lat=pt["lat"], lng=pt["lng"],
                category_id=cat_id,
                limit=limit_per_point,
                distance_km=pt["distance_km"],
            )

            for v in venues:
                vid = v.get("fsq_id", v["name"])
                if vid not in seen_ids:
                    seen_ids.add(vid)
                    v["route_distance_km"] = pt["distance_km"]
                    all_results[cat_name].append(v)

    total = sum(len(v) for v in all_results.values())
    return {
        "source": src_geo,
        "destination": dst_geo,
        "route_distance_km": round(total_distance, 1),
        "sample_points": len(sampled),
        "results": all_results,
        "total_count": total,
    }


async def _search_at_point(lat: float, lng: float, category_id: str, limit: int, distance_km: float) -> list[dict]:
    """Search for POIs near a specific lat/lng using Mapbox Geocoding API."""
    token = _get_mapbox_token()
    if not token:
        return []

    # category_id here is actually the search query from CATEGORY_MAP (e.g. "hotel,resort,lodge")
    # Use the first term for the geocoding search
    search_terms = category_id.split(",")
    search_query = search_terms[0].strip()

    url = f"{MAPBOX_BASE}/geocoding/v5/mapbox.places/{search_query}.json"
    params = {
        "access_token": token,
        "types": "poi",
        "limit": str(min(limit, 10)),
        "proximity": f"{lng},{lat}",
        "language": "en",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])

            formatted = []
            for f in features:
                center = f.get("center", [0, 0])
                props = f.get("properties", {})
                categories = props.get("category", "").split(", ") if props.get("category") else []

                formatted.append({
                    "fsq_id": f.get("id", ""),
                    "name": f.get("text", "Unknown"),
                    "address": f.get("place_name", ""),
                    "locality": "",
                    "latitude": center[1] if len(center) > 1 else None,
                    "longitude": center[0] if len(center) > 0 else None,
                    "category": categories[0] if categories else search_query.title(),
                    "rating": None,
                    "price": None,
                    "tip": None,
                    "source": "mapbox",
                })
            return formatted
        except httpx.HTTPStatusError as e:
            logger.error(f"Mapbox POI error at ({lat},{lng}): {e.response.status_code}")
            return []
        except Exception as e:
            logger.error(f"Mapbox POI request failed at ({lat},{lng}): {e}")
            return []

