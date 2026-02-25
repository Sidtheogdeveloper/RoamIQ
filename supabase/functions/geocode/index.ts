import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { locations, proximity } = await req.json();
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return new Response(JSON.stringify({ error: "locations array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "Mapbox token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build proximity query param if provided (lng,lat)
    const proximityParam = proximity
      ? `&proximity=${proximity.lng},${proximity.lat}`
      : "";

    const results = await Promise.all(
      locations.map(async (loc: string) => {
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loc)}.json?access_token=${token}&limit=1${proximityParam}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { location: loc, lat, lng, placeName: data.features[0].place_name };
          }
          return { location: loc, lat: null, lng: null, placeName: null };
        } catch {
          return { location: loc, lat: null, lng: null, placeName: null };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
