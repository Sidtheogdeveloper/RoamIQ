import { useState, useEffect } from 'react';

/**
 * Module-level cache to avoid re-fetching images for the same destination.
 */
const imageCache = new Map<string, string>();

/**
 * Curated destination-to-image mapping for popular cities.
 * These are high-quality Unsplash photo IDs that are guaranteed to load.
 */
const CURATED_IMAGES: Record<string, string> = {
    'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=400&fit=crop&q=80',
    'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=400&fit=crop&q=80',
    'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=400&fit=crop&q=80',
    'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=400&fit=crop&q=80',
    'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&h=400&fit=crop&q=80',
    'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=400&fit=crop&q=80',
    'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=400&fit=crop&q=80',
    'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=400&fit=crop&q=80',
    'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&h=400&fit=crop&q=80',
    'istanbul': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&h=400&fit=crop&q=80',
    'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&h=400&fit=crop&q=80',
    'mumbai': 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=800&h=400&fit=crop&q=80',
    'delhi': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&h=400&fit=crop&q=80',
    'goa': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&h=400&fit=crop&q=80',
    'jaipur': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&h=400&fit=crop&q=80',
    'chennai': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&h=400&fit=crop&q=80',
    'kerala': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=400&fit=crop&q=80',
    'amsterdam': 'https://images.unsplash.com/photo-1534351590666-13e3e96b5571?w=800&h=400&fit=crop&q=80',
    'venice': 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800&h=400&fit=crop&q=80',
    'berlin': 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&h=400&fit=crop&q=80',
    'san francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=400&fit=crop&q=80',
    'los angeles': 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=800&h=400&fit=crop&q=80',
    'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=400&fit=crop&q=80',
    'maldives': 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&h=400&fit=crop&q=80',
    'cairo': 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=800&h=400&fit=crop&q=80',
    'hong kong': 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800&h=400&fit=crop&q=80',
    'seoul': 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=800&h=400&fit=crop&q=80',
    'prague': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&h=400&fit=crop&q=80',
    'vienna': 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&h=400&fit=crop&q=80',
    'lisbon': 'https://images.unsplash.com/photo-1558303913-0dfa4a301f68?w=800&h=400&fit=crop&q=80',
    'athens': 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&h=400&fit=crop&q=80',
    'madrid': 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&h=400&fit=crop&q=80',
    'zurich': 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&h=400&fit=crop&q=80',
    'copenhagen': 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=800&h=400&fit=crop&q=80',
};

/**
 * Generate a vibrant gradient based on the destination name — used as fallback.
 */
function getGradientForDestination(destination: string): string {
    let hash = 0;
    for (let i = 0; i < destination.length; i++) {
        hash = destination.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 65%, 35%), hsl(${h2}, 55%, 50%))`;
}

/**
 * Uses the Mapbox Static Images API to fetch a satellite-style aerial view of the destination.
 * This is a creative, "AI-like" approach — the Mapbox token is already available.
 */
function getMapboxStaticImage(destination: string, lat: number, lng: number): string {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token) return '';
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},11,0/800x400@2x?access_token=${token}`;
}

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

async function geocodeForImage(destination: string): Promise<{ lat: number; lng: number } | null> {
    if (!mapboxToken) return null;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?access_token=${mapboxToken}&limit=1&types=place,region,country,locality`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.features?.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { lat, lng };
        }
        return null;
    } catch {
        return null;
    }
}

interface UseDestinationImageResult {
    imageUrl: string | null;
    gradient: string;
    loading: boolean;
}

export function useDestinationImage(destination: string): UseDestinationImageResult {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const gradient = getGradientForDestination(destination);

    useEffect(() => {
        if (!destination) {
            setLoading(false);
            return;
        }

        // Check cache first
        if (imageCache.has(destination)) {
            setImageUrl(imageCache.get(destination)!);
            setLoading(false);
            return;
        }

        // Check curated images
        const destLower = destination.toLowerCase().trim();
        for (const [key, url] of Object.entries(CURATED_IMAGES)) {
            if (destLower.includes(key) || key.includes(destLower)) {
                imageCache.set(destination, url);
                setImageUrl(url);
                setLoading(false);
                return;
            }
        }

        // Fallback: use Mapbox satellite static image
        let cancelled = false;
        geocodeForImage(destination).then((coords) => {
            if (cancelled) return;
            if (coords) {
                const url = getMapboxStaticImage(destination, coords.lat, coords.lng);
                if (url) {
                    imageCache.set(destination, url);
                    setImageUrl(url);
                }
            }
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [destination]);

    return { imageUrl, gradient, loading };
}
