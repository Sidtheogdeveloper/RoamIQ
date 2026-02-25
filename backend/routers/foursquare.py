"""
Foursquare-powered venue discovery endpoints.
Returns real hotel, restaurant, and attraction data from Foursquare Places API.
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.foursquare import search_places, resolve_categories, CATEGORY_MAP
from services.route_venues import search_venues_along_route

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/foursquare", tags=["Foursquare"])


class NearbyRequest(BaseModel):
    destination: str
    categories: Optional[list[str]] = None  # ["hotels", "restaurants", "attractions"]
    query: Optional[str] = None             # Free-text search
    limit: int = 10
    radius: int = 10000                     # meters


class RouteVenuesRequest(BaseModel):
    source: str                              # Source city (e.g. "Chennai, India")
    destination: str                         # Destination city (e.g. "Kanyakumari, India")
    categories: Optional[list[str]] = None   # ["hotels", "restaurants"]
    interval_km: float = 50.0               # Sample every N km
    limit_per_point: int = 3                # Venues per sample point


@router.post("/nearby")
async def get_nearby_places(req: NearbyRequest):
    """
    Search for nearby hotels, restaurants, and attractions using Foursquare.
    Groups results by category.
    """
    requested_categories = req.categories or ["hotels", "restaurants", "attractions"]

    all_results: dict[str, list[dict]] = {}

    for cat_name in requested_categories:
        cat_id = CATEGORY_MAP.get(cat_name.lower())
        if not cat_id:
            logger.warning(f"Unknown category: {cat_name}")
            continue

        results = await search_places(
            query=req.query,
            near=req.destination,
            categories=cat_id,
            limit=req.limit,
            radius=req.radius,
            sort="RELEVANCE",
        )
        all_results[cat_name] = results
        logger.info(f"Foursquare '{cat_name}' in '{req.destination}': {len(results)} results")

    total = sum(len(v) for v in all_results.values())
    return {
        "destination": req.destination,
        "results": all_results,
        "total_count": total,
    }


@router.post("/route-venues")
async def get_route_venues(req: RouteVenuesRequest):
    """
    Find hotels and restaurants along the driving route from source to destination.
    Uses Mapbox Directions API for the route and Foursquare for venue discovery.
    """
    categories = req.categories or ["hotels", "restaurants"]

    result = await search_venues_along_route(
        source=req.source,
        destination=req.destination,
        categories=categories,
        interval_km=req.interval_km,
        limit_per_point=req.limit_per_point,
    )

    return result

