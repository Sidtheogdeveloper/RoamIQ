import { useState, useEffect, useCallback } from 'react';

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export interface EmergencyPlace {
  name: string;
  lat: number;
  lng: number;
  address: string;
  distance: number; // km
}

interface UseNearbyEmergencyResult {
  policeStations: EmergencyPlace[];
  hospitals: EmergencyPlace[];
  userLat: number | null;
  userLng: number | null;
  loading: boolean;
  error: string | null;
  usingGeolocation: boolean;
  refetch: () => void;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeDestination(destination: string): Promise<{ lat: number; lng: number } | null> {
  if (!mapboxToken || !destination) return null;
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

async function searchPOI(
  category: string,
  lat: number,
  lng: number,
  limit = 5,
): Promise<EmergencyPlace[]> {
  if (!mapboxToken) return [];

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(category)}.json?access_token=${mapboxToken}&limit=${limit}&proximity=${lng},${lat}&types=poi`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.features) return [];

    return data.features.map((f: any) => {
      const [fLng, fLat] = f.center;
      return {
        name: f.text || f.place_name?.split(',')[0] || 'Unknown',
        lat: fLat,
        lng: fLng,
        address: f.place_name || '',
        distance: Math.round(haversineDistance(lat, lng, fLat, fLng) * 10) / 10,
      };
    }).sort((a: EmergencyPlace, b: EmergencyPlace) => a.distance - b.distance);
  } catch {
    return [];
  }
}

export function useNearbyEmergency(destination?: string): UseNearbyEmergencyResult {
  const [policeStations, setPoliceStations] = useState<EmergencyPlace[]>([]);
  const [hospitals, setHospitals] = useState<EmergencyPlace[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingGeolocation, setUsingGeolocation] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => setFetchTrigger((p) => p + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchData = async (lat: number, lng: number) => {
      if (cancelled) return;
      setUserLat(lat);
      setUserLng(lng);

      const [police, hosp] = await Promise.all([
        searchPOI('police station', lat, lng, 5),
        searchPOI('hospital', lat, lng, 5),
      ]);

      if (!cancelled) {
        setPoliceStations(police);
        setHospitals(hosp);
        setLoading(false);
      }
    };

    // Try browser geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) {
            setUsingGeolocation(true);
            fetchData(pos.coords.latitude, pos.coords.longitude);
          }
        },
        async () => {
          // Geolocation denied/unavailable — fall back to destination geocoding
          if (cancelled) return;
          setUsingGeolocation(false);
          if (destination) {
            const coords = await geocodeDestination(destination);
            if (coords && !cancelled) {
              fetchData(coords.lat, coords.lng);
            } else if (!cancelled) {
              setError('Could not determine location');
              setLoading(false);
            }
          } else {
            setError('Location access denied and no destination provided');
            setLoading(false);
          }
        },
        { timeout: 8000, enableHighAccuracy: false },
      );
    } else if (destination) {
      // No geolocation API — fall back to destination
      setUsingGeolocation(false);
      geocodeDestination(destination).then((coords) => {
        if (coords && !cancelled) {
          fetchData(coords.lat, coords.lng);
        } else if (!cancelled) {
          setError('Could not determine location');
          setLoading(false);
        }
      });
    } else {
      setError('No location available');
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [destination, fetchTrigger]);

  return { policeStations, hospitals, userLat, userLng, loading, error, usingGeolocation, refetch };
}
