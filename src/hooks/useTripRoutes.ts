import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type ItineraryItem = Tables<'itinerary_items'>;

export interface GeocodedItem extends ItineraryItem {
    lat: number;
    lng: number;
    placeName?: string;
}

export interface RouteSegment {
    from: string;
    to: string;
    distance_km: number;
    duration_min: number;
    duration_traffic_min: number;
    congestion: 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';
    geojson: any;
}

export interface RouteData {
    geojson: any;
    distance_km: number;
    duration_min: number;
    duration_traffic_min: number;
    isTrafficEstimate: boolean;
    isOptimized: boolean;
    segments: RouteSegment[];
    waypointOrder?: number[];
}

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

/**
 * Calculate the haversine distance between two lat/lng points in km.
 */
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Maximum allowed distance (km) from destination center for a geocoded marker */
const MAX_MARKER_DISTANCE_KM = 25;

async function geocodeLocation(
    query: string,
    destLat: number,
    destLng: number,
): Promise<{ lat: number; lng: number; placeName: string } | null> {
    if (!mapboxToken || !query.trim()) return null;

    // Tight bounding box: ±0.3° ≈ ~33 km around destination
    const bboxPad = 0.3;
    const bbox = [
        destLng - bboxPad,
        destLat - bboxPad,
        destLng + bboxPad,
        destLat + bboxPad,
    ].join(',');

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=3&bbox=${bbox}&proximity=${destLng},${destLat}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
            // Pick the closest result within the distance limit
            for (const feature of data.features) {
                const [lng, lat] = feature.center;
                const distKm = haversineDistanceKm(destLat, destLng, lat, lng);
                if (distKm <= MAX_MARKER_DISTANCE_KM) {
                    return { lat, lng, placeName: feature.place_name };
                }
            }
        }

        // Fallback: search without bbox but still validate distance
        const fallbackUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=3&proximity=${destLng},${destLat}`;
        const fallbackRes = await fetch(fallbackUrl);
        const fallbackData = await fallbackRes.json();
        if (fallbackData.features && fallbackData.features.length > 0) {
            for (const feature of fallbackData.features) {
                const [lng, lat] = feature.center;
                const distKm = haversineDistanceKm(destLat, destLng, lat, lng);
                if (distKm <= MAX_MARKER_DISTANCE_KM) {
                    return { lat, lng, placeName: feature.place_name };
                }
            }
        }
        return null;
    } catch {
        return null;
    }
}

async function geocodeDestination(
    destination: string,
): Promise<{ lat: number; lng: number } | null> {
    if (!mapboxToken) return null;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?access_token=${mapboxToken}&limit=1&types=place,region,country,locality`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { lat, lng };
        }
        return null;
    } catch {
        return null;
    }
}

export function useTripRoutes(items: ItineraryItem[], destination: string | undefined) {
    const [allGeocoded, setAllGeocoded] = useState<GeocodedItem[]>([]);
    const [dayRoutes, setDayRoutes] = useState<Record<number, RouteData>>({});
    const [tripStats, setTripStats] = useState<{
        total_km: number;
        total_min: number;
        total_traffic_min: number;
        isFallback: boolean;
    } | null>(null);
    const [loading, setLoading] = useState(false);

    const prevDestRef = useRef<string>('');
    const geocodeCacheRef = useRef<Record<string, { lat: number; lng: number; placeName: string } | null>>({});
    const routeCacheRef = useRef<Record<string, RouteData>>({});

    const allItems = useMemo(
        () => [...items].sort((a, b) => a.day_number - b.day_number || a.sort_order - b.sort_order),
        [items]
    );

    const geocodeAllItems = useCallback(async () => {
        if (!destination || !mapboxToken) {
            setLoading(false);
            return;
        }

        // Words that indicate a vague/generic location — partial match
        const VAGUE_KEYWORDS = [
            'breakfast', 'lunch', 'dinner', 'snack', 'brunch', 'supper',
            'food', 'eat', 'meal', 'drinks', 'coffee break',
            'hotel', 'hostel', 'resort', 'accommodation', 'stay', 'lodging',
            'airport', 'bus stop', 'taxi', 'uber', 'cab', 'transit',
            'rest', 'sleep', 'nap', 'check-in', 'check-out', 'checkin', 'checkout',
            'free time', 'leisure', 'relax', 'shopping',
            'home', 'office', 'parking',
        ];

        // Item types that need a specific/long location name to be geocoded
        const GENERIC_TYPES = new Set(['meal', 'transport', 'free_time', 'hotel_checkin', 'hotel_checkout']);

        const isValidForGeocoding = (item: ItineraryItem): boolean => {
            const loc = (item.location || '').trim();
            if (loc.length < 3) return false;

            const locLower = loc.toLowerCase();
            const titleLower = (item.title || '').toLowerCase();

            // Check if location or title contains vague keywords
            for (const keyword of VAGUE_KEYWORDS) {
                if (locLower === keyword) return false;
                // Only reject partial matches for very short locations (ambiguous)
                if (loc.length < 20 && locLower.includes(keyword)) return false;
            }

            // For generic item types (meals, transport, etc.), require a specific enough location
            if (GENERIC_TYPES.has(item.item_type)) {
                // If location is short and generic, skip it
                if (loc.length < 15) return false;
                // If the title is basically just a meal name, skip
                for (const keyword of VAGUE_KEYWORDS) {
                    if (titleLower === keyword || titleLower.startsWith(keyword + ' ')) {
                        if (loc.length < 25) return false;
                    }
                }
            }

            return true;
        };

        const allLocations: string[] = [];
        allItems.forEach((item) => {
            if (item.location && isValidForGeocoding(item)) {
                allLocations.push(item.location);
            } else if (item.location) {
                console.log(`[Map] ⊘ Skipped "${item.title}" (location: "${item.location}", type: ${item.item_type}) — too vague`);
            }
        });
        const uniqueLocations = Array.from(new Set(allLocations));

        try {
            const destCoords = await geocodeDestination(destination);
            if (!destCoords) {
                console.warn('[Map] Could not geocode destination:', destination);
                setLoading(false);
                return;
            }
            console.log(`[Map] Destination "${destination}" → ${destCoords.lat.toFixed(4)}, ${destCoords.lng.toFixed(4)}`);

            const coordMap: Record<string, { lat: number; lng: number; placeName: string }> = {};

            for (let i = 0; i < uniqueLocations.length; i += 5) {
                const batch = uniqueLocations.slice(i, i + 5);
                const results = await Promise.all(
                    batch.map(async (loc) => {
                        const cacheKey = `${loc}__${destination}`;
                        if (geocodeCacheRef.current[cacheKey] !== undefined) {
                            return { loc, result: geocodeCacheRef.current[cacheKey] };
                        }

                        const queryWithDest = loc.toLowerCase().includes(destination.toLowerCase())
                            ? loc
                            : `${loc}, ${destination}`;

                        const result = await geocodeLocation(queryWithDest, destCoords.lat, destCoords.lng);
                        geocodeCacheRef.current[cacheKey] = result;

                        if (result) {
                            const dist = haversineDistanceKm(destCoords.lat, destCoords.lng, result.lat, result.lng);
                            console.log(`[Map] ✓ "${loc}" → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} (${dist.toFixed(1)} km from dest)`);
                        } else {
                            console.log(`[Map] ✗ "${loc}" → rejected (too far or not found)`);
                        }

                        return { loc, result };
                    })
                );

                results.forEach(({ loc, result }) => {
                    if (result) {
                        coordMap[loc] = result;
                    }
                });
            }

            const geocodedItems: GeocodedItem[] = allItems
                .filter((item) => item.location && coordMap[item.location])
                .map((item) => {
                    const c = coordMap[item.location!];
                    return { ...item, lat: c.lat, lng: c.lng, placeName: c.placeName };
                });

            setAllGeocoded(geocodedItems);
        } catch (err) {
            console.error('Geocoding error:', err);
        } finally {
            setLoading(false);
        }
    }, [allItems, destination]);

    useEffect(() => {
        if (!destination) return;
        if (prevDestRef.current !== destination || allItems.length > 0 && allGeocoded.length === 0) {
            setLoading(true);
            prevDestRef.current = destination;
            geocodeCacheRef.current = {};
            geocodeAllItems();
        }
    }, [geocodeAllItems, destination, allItems.length]); // Re-run if items change and we haven't geocoded them

    // Reset geocoded when length drastically changes (e.g. adding a new item)
    useEffect(() => {
        if (allItems.length !== allGeocoded.length && !loading) {
            // Quick trigger to re-geocode
            geocodeAllItems();
        }
    }, [allItems.length]);

    const fetchDirectionsRoute = useCallback(
        async (waypoints: { lng: number; lat: number; title?: string }[], dayDate?: string): Promise<RouteData | null> => {
            if (waypoints.length < 2 || !mapboxToken) return null;

            const limited = waypoints.length > 25
                ? waypoints.filter((_, i) => i === 0 || i === waypoints.length - 1 || i % Math.ceil(waypoints.length / 23) === 0)
                : waypoints;

            const coords = limited.map((w) => `${w.lng},${w.lat}`).join(';');
            const cacheKey = `dir_${coords}`;
            if (routeCacheRef.current[cacheKey]) return routeCacheRef.current[cacheKey];

            let departAt = '';
            let isFallback = false;
            if (dayDate) {
                const targetDate = new Date(dayDate);
                const now = new Date();
                if (targetDate > now) {
                    const fallback = new Date(now);
                    fallback.setDate(fallback.getDate() - 2);
                    fallback.setHours(9, 0, 0, 0);
                    departAt = fallback.toISOString().split('.')[0] + 'Z';
                    isFallback = true;
                } else {
                    targetDate.setHours(9, 0, 0, 0);
                    departAt = targetDate.toISOString().split('.')[0] + 'Z';
                }
            }

            const params = new URLSearchParams({
                access_token: mapboxToken,
                geometries: 'geojson',
                overview: 'full',
                annotations: 'duration,distance,congestion',
                steps: 'true',
            });
            if (departAt) params.set('depart_at', departAt);

            try {
                const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];

                    // Build per-segment breakdown from legs
                    const segments: RouteSegment[] = [];
                    if (route.legs) {
                        route.legs.forEach((leg: any, idx: number) => {
                            // Determine congestion level from annotations
                            let congestion: RouteSegment['congestion'] = 'unknown';
                            if (leg.annotation?.congestion) {
                                const congestArr = leg.annotation.congestion as string[];
                                const heavy = congestArr.filter((c: string) => c === 'heavy' || c === 'severe').length;
                                const moderate = congestArr.filter((c: string) => c === 'moderate').length;
                                const ratio = congestArr.length > 0 ? (heavy + moderate * 0.5) / congestArr.length : 0;
                                if (ratio > 0.5) congestion = 'heavy';
                                else if (ratio > 0.25) congestion = 'moderate';
                                else congestion = 'low';
                            }

                            segments.push({
                                from: limited[idx]?.title || `Point ${idx + 1}`,
                                to: limited[idx + 1]?.title || `Point ${idx + 2}`,
                                distance_km: Math.round(leg.distance / 100) / 10,
                                duration_min: Math.round(leg.duration / 60),
                                duration_traffic_min: Math.round((leg.duration_typical || leg.duration) / 60),
                                congestion,
                                geojson: leg.steps ? {
                                    type: 'Feature' as const,
                                    properties: { congestion },
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: leg.steps.flatMap((s: any) => s.geometry.coordinates),
                                    },
                                } : null,
                            });
                        });
                    }

                    const result: RouteData = {
                        geojson: {
                            type: 'Feature' as const,
                            properties: {},
                            geometry: route.geometry,
                        },
                        distance_km: Math.round(route.distance / 100) / 10,
                        duration_min: Math.round(route.duration / 60),
                        duration_traffic_min: Math.round((route.duration_typical || route.duration) / 60),
                        isTrafficEstimate: isFallback,
                        isOptimized: false,
                        segments,
                    };
                    routeCacheRef.current[cacheKey] = result;
                    return result;
                }
                return null;
            } catch (err) {
                console.error('Directions API error:', err);
                return null;
            }
        },
        []
    );

    /**
     * Mapbox Optimization API v1 — finds the quickest order to visit all waypoints.
     * Uses `driving-traffic` profile for real-time traffic-aware routing.
     * Falls back to regular directions if optimization fails.
     */
    const fetchOptimizedRoute = useCallback(
        async (waypoints: { lng: number; lat: number; title?: string }[], dayDate?: string): Promise<RouteData | null> => {
            if (waypoints.length < 2 || !mapboxToken) return null;

            // Mapbox Optimization API v1 supports max 12 coordinates
            if (waypoints.length > 12) {
                console.log(`[Route] ${waypoints.length} waypoints exceeds optimization limit (12), using directions`);
                return fetchDirectionsRoute(waypoints, dayDate);
            }

            const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
            const cacheKey = `opt_${coords}`;
            if (routeCacheRef.current[cacheKey]) return routeCacheRef.current[cacheKey];

            // source=first, destination=last, reorder everything in between
            const params = new URLSearchParams({
                access_token: mapboxToken,
                geometries: 'geojson',
                overview: 'full',
                annotations: 'duration,distance,congestion',
                steps: 'true',
                source: 'first',
                destination: 'last',
                roundtrip: 'false',
            });

            try {
                const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coords}?${params}`;
                console.log(`[Route] Optimizing ${waypoints.length} waypoints via Optimization API...`);
                const res = await fetch(url);
                const data = await res.json();

                if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
                    const trip = data.trips[0];
                    const waypointOrder = data.waypoints?.map((wp: any) => wp.waypoint_index) || [];

                    // Build per-segment breakdown
                    const segments: RouteSegment[] = [];
                    const orderedWaypoints = waypointOrder.length > 0
                        ? waypointOrder.map((idx: number) => waypoints[idx])
                        : waypoints;

                    if (trip.legs) {
                        trip.legs.forEach((leg: any, idx: number) => {
                            let congestion: RouteSegment['congestion'] = 'unknown';
                            if (leg.annotation?.congestion) {
                                const congestArr = leg.annotation.congestion as string[];
                                const heavy = congestArr.filter((c: string) => c === 'heavy' || c === 'severe').length;
                                const moderate = congestArr.filter((c: string) => c === 'moderate').length;
                                const ratio = congestArr.length > 0 ? (heavy + moderate * 0.5) / congestArr.length : 0;
                                if (ratio > 0.5) congestion = 'heavy';
                                else if (ratio > 0.25) congestion = 'moderate';
                                else congestion = 'low';
                            }

                            segments.push({
                                from: orderedWaypoints[idx]?.title || `Stop ${idx + 1}`,
                                to: orderedWaypoints[idx + 1]?.title || `Stop ${idx + 2}`,
                                distance_km: Math.round(leg.distance / 100) / 10,
                                duration_min: Math.round(leg.duration / 60),
                                duration_traffic_min: Math.round((leg.duration_typical || leg.duration) / 60),
                                congestion,
                                geojson: leg.steps ? {
                                    type: 'Feature' as const,
                                    properties: { congestion },
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: leg.steps.flatMap((s: any) => s.geometry.coordinates),
                                    },
                                } : null,
                            });
                        });
                    }

                    const isReordered = waypointOrder.length > 0 &&
                        !waypointOrder.every((idx: number, i: number) => idx === i);

                    if (isReordered) {
                        console.log(`[Route] ✓ Optimized order: ${waypointOrder.map((i: number) => orderedWaypoints[i]?.title || i).join(' → ')}`);
                    } else {
                        console.log(`[Route] ✓ Original order is already optimal`);
                    }

                    const result: RouteData = {
                        geojson: {
                            type: 'Feature' as const,
                            properties: {},
                            geometry: trip.geometry,
                        },
                        distance_km: Math.round(trip.distance / 100) / 10,
                        duration_min: Math.round(trip.duration / 60),
                        duration_traffic_min: Math.round((trip.duration_typical || trip.duration) / 60),
                        isTrafficEstimate: false,
                        isOptimized: true,
                        segments,
                        waypointOrder,
                    };
                    routeCacheRef.current[cacheKey] = result;
                    return result;
                }

                // Optimization failed — fall back to regular directions
                console.warn('[Route] Optimization API failed, falling back to directions', data.code, data.message);
                return fetchDirectionsRoute(waypoints, dayDate);
            } catch (err) {
                console.error('[Route] Optimization API error:', err);
                return fetchDirectionsRoute(waypoints, dayDate);
            }
        },
        [fetchDirectionsRoute]
    );

    useEffect(() => {
        if (allGeocoded.length < 2) return;

        const fetchAllRoutes = async () => {
            const dayGroups: Record<number, GeocodedItem[]> = {};
            allGeocoded.forEach((g) => {
                if (!dayGroups[g.day_number]) dayGroups[g.day_number] = [];
                dayGroups[g.day_number].push(g);
            });

            const newRoutes: Record<number, RouteData> = {};
            let totalKm = 0;
            let totalMin = 0;
            let totalTrafficMin = 0;
            let anyFallback = false;

            for (const [dayStr, dayItems] of Object.entries(dayGroups)) {
                const day = Number(dayStr);
                if (dayItems.length < 2) continue;

                // Build waypoints with titles for logging
                const waypoints = dayItems.map((g) => ({
                    lng: g.lng,
                    lat: g.lat,
                    title: g.title || g.location || undefined,
                }));

                // Use Optimization API for quickest path ordering
                console.log(`[Route] Day ${day}: optimizing ${waypoints.length} waypoints...`);
                const route = await fetchOptimizedRoute(waypoints);
                if (route) {
                    newRoutes[day] = route;
                    totalKm += route.distance_km;
                    totalMin += route.duration_min;
                    totalTrafficMin += route.duration_traffic_min;
                    if (route.isTrafficEstimate) anyFallback = true;

                    // Log per-segment traffic
                    route.segments.forEach((seg) => {
                        const trafficIcon = seg.congestion === 'heavy' || seg.congestion === 'severe' ? '🔴'
                            : seg.congestion === 'moderate' ? '🟡' : '🟢';
                        console.log(`[Route] ${trafficIcon} ${seg.from} → ${seg.to}: ${seg.distance_km}km, ${seg.duration_traffic_min}min (${seg.congestion})`);
                    });
                }
            }

            setDayRoutes(newRoutes);
            if (totalKm > 0) {
                setTripStats({
                    total_km: Math.round(totalKm * 10) / 10,
                    total_min: totalMin,
                    total_traffic_min: totalTrafficMin,
                    isFallback: anyFallback,
                });
            }
        };

        fetchAllRoutes();
    }, [allGeocoded, fetchOptimizedRoute]);

    // Re-fetch routes when items change (e.g., task completion, reorder)
    const prevItemsRef = useRef<string>('');
    useEffect(() => {
        const itemsKey = allItems.map(i => `${i.id}_${i.is_completed}_${i.sort_order}`).join('|');
        if (prevItemsRef.current && prevItemsRef.current !== itemsKey) {
            // Items changed (completion, reorder, etc.) — invalidate route cache and re-geocode
            console.log('[Route] Items changed, re-computing routes...');
            routeCacheRef.current = {};
            geocodeAllItems();
        }
        prevItemsRef.current = itemsKey;
    }, [allItems, geocodeAllItems]);

    return { allGeocoded, dayRoutes, tripStats, loading };
}
