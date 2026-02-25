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
    const { destination, categories, tripDays } = await req.json();

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Destination is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const selectedCategories = categories?.length ? categories : ['hotels', 'restaurants', 'attractions'];

    const prompt = `You are a local travel expert for ${destination}. Recommend the best places for a ${tripDays || 3}-day trip.

For each of these categories: ${selectedCategories.join(', ')}, provide 4-5 recommendations.

Return a JSON object with this structure:
{
  "hotels": [{ "name": "...", "description": "One sentence", "priceRange": "$" | "$$" | "$$$" | "$$$$", "rating": 4.5, "location": "neighborhood", "highlight": "One unique selling point", "isIndoor": true }],
  "restaurants": [{ "name": "...", "description": "One sentence", "cuisine": "...", "priceRange": "$" | "$$" | "$$$" | "$$$$", "rating": 4.5, "location": "neighborhood", "highlight": "Signature dish or experience", "isIndoor": true }],
  "attractions": [{ "name": "...", "description": "One sentence", "category": "museum" | "landmark" | "nature" | "entertainment" | "market" | "viewpoint", "duration": "1-2 hours", "rating": 4.5, "location": "neighborhood", "highlight": "What makes it special", "isIndoor": false, "bestTime": "morning" | "afternoon" | "evening" | "anytime" }]
}

Only include categories that were requested. Return ONLY the JSON object, no markdown or explanation.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a travel recommendation expert. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let recommendations: any;
    try {
      recommendations = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response:', jsonStr.substring(0, 500));
      return new Response(JSON.stringify({ error: 'Failed to parse recommendations' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('get-recommendations error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
