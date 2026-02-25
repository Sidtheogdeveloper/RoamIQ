import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, weather, itineraryItems, deletedItem, allTripItems, routeData } = await req.json();

    if (!destination) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build list of all existing activities across all days to avoid duplicates
    const existingActivities = (allTripItems || itineraryItems || [])
      .map((item: any) => item.title)
      .filter(Boolean);

    let prompt: string;

    if (deletedItem) {
      // Deletion mode: suggest replacements for the deleted item
      prompt = `You are a travel planning expert for ${destination}.

An activity was just removed from the itinerary:
- Deleted: "${deletedItem.title}" (${deletedItem.start_time || 'no time'} - ${deletedItem.end_time || 'no time'}, location: ${deletedItem.location || 'unknown'}, type: ${deletedItem.item_type}, duration: ${deletedItem.duration_minutes || 60} min)

Current remaining activities for this day:
${(itineraryItems || []).map((item: any, i: number) => `${i + 1}. "${item.title}" at ${item.location || 'unknown'} (${item.start_time || 'no time'} - ${item.end_time || 'no time'})`).join('\n') || 'No other activities'}

${weather ? `Weather: ${weather.temp}°C, ${weather.condition}, ${weather.rainProbability}% rain chance` : ''}

IMPORTANT: Do NOT suggest any of these activities that are already in the trip across ALL days:
${existingActivities.map((a: string) => `- "${a}"`).join('\n') || 'None'}

Suggest 2-3 replacement activities that:
1. Fit the same time slot as the deleted activity
2. Are unique and NOT already in any day of the trip
3. Are appropriate for the weather conditions
4. Are real places/activities in ${destination}

Return a JSON array:
[{
  "id": "unique_id",
  "type": "activity_swap",
  "priority": "medium",
  "title": "Short action title",
  "description": "What to do and why",
  "reason": "Replacement for removed activity",
  "impact": "Positive outcome",
  "affectedActivity": "${deletedItem.title}",
  "alternativeActivity": "Suggested replacement name",
  "suggestedTime": "${deletedItem.start_time || ''}",
  "suggestedDuration": ${deletedItem.duration_minutes || 60}
}]

Return ONLY the JSON array.`;
    } else if (!weather || !(itineraryItems?.length)) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Weather & Traffic mode
      const trafficContext = routeData ? `
Traffic & Route Conditions for today:
- Total Distance: ${routeData.distance_km} km
- Base Drive Time: ${routeData.duration_min} mins
- Estimated Drive Time (with traffic): ${routeData.duration_traffic_min} mins
` : '';

      prompt = `You are a travel adaptation expert for ${destination}.

Current conditions:
- Temperature: ${weather.temp}°C (feels like ${weather.feelsLike}°C)
- Condition: ${weather.condition}
- Rain probability: ${weather.rainProbability}%
- Wind speed: ${weather.windSpeed} km/h
- Humidity: ${weather.humidity}%
${trafficContext}

Today's itinerary:
${itineraryItems.map((item: any, i: number) => `${i + 1}. "${item.title}" at ${item.location || 'unknown location'} (${item.start_time || 'no time'} - ${item.end_time || 'no time'}, outdoor: ${item.is_outdoor})`).join('\n')}

IMPORTANT: Do NOT suggest any of these activities that are already in the trip:
${existingActivities.map((a: string) => `- "${a}"`).join('\n') || 'None'}

Analyze the weather and traffic impact. Generate smart suggestions focusing on:
1. Indoor alternatives for outdoor activities if rain probability > 40% or stormy.
2. Timing changes to avoid bad weather windows OR heavy traffic (if estimated drive time is significantly higher than base drive time).
3. Safety recommendations for extreme weather.
4. Activity swaps that maintain the trip's quality.

Return a JSON array:
[{
  "id": "unique_id",
  "type": "indoor_alternative" | "timing_change" | "safety_warning" | "activity_swap",
  "priority": "high" | "medium" | "low",
  "title": "Short action title",
  "description": "What to do and why",
  "reason": "Weather or traffic-based reason",
  "impact": "Positive outcome",
  "affectedActivity": "Name of the affected activity or null",
  "alternativeActivity": "Suggested replacement name or null"
}]

Only suggest changes where weather or traffic genuinely impacts the activity or schedule. If conditions are fine, return an empty array.
Return ONLY the JSON array.`;
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a weather-aware travel advisor. Return only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let suggestions: any[];
    try {
      suggestions = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse suggestions:', jsonStr.substring(0, 500));
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('adaptive-suggestions error:', error);
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});