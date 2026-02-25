import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tripId, destination, sourceCity, hotelName, startDate, endDate, description, budget, currency } = await req.json();

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const budgetStr = budget ? `${currency || 'USD'} ${budget}` : null;

    // Build a theme instruction if the user gave a description
    const themeBlock = description
      ? `\nTRIP THEME / FOCUS: "${description}"
You MUST tailor every single activity to match this theme. Examples:
- "temple visit" or "spiritual" → plan ONLY temples, shrines, ashrams, spiritual centres. Meals at local vegetarian restaurants. Skip bars, nightclubs, adventure sports.
- "photography trip" → focus on the most photogenic & scenic spots, golden hour timings, sunrise/sunset viewpoints, colorful markets, architectural landmarks.
- "adventure trip" → trekking, water sports, zip-lining, off-road drives, camping. Skip museums and sedentary activities.
- "food tour" → street food walks, cooking classes, famous restaurants, local markets, food festivals. Every meal should be a highlight.
- "family trip" → kid-friendly attractions, amusement parks, easy walks, family restaurants. Avoid late nights.
- "romantic getaway" → couples activities, sunset cruises, fine dining, spa, scenic drives. Avoid crowded tourist traps.
- "heritage / history" → historical monuments, museums, heritage walks, local guides, cultural performances.
- For any other description, infer the intent and customize accordingly.
Do NOT include generic filler activities that don't match the theme. Every activity should relate to "${description}".
`
      : '';

    const prompt = `Generate a detailed ${totalDays}-day travel itinerary for a trip to ${destination}${sourceCity ? ` departing from ${sourceCity}` : ''}${hotelName ? `, staying at ${hotelName}` : ''}.
${themeBlock}
${budgetStr ? `BUDGET CONSTRAINT: The total trip budget is ${budgetStr}. This must cover travel, accommodation, food, activities, and transport.
- If this budget is unrealistically low for even basic travel to ${destination} for ${totalDays} days (e.g. can't even cover round-trip transport), respond with ONLY: {"error": "BUDGET_TOO_LOW", "message": "A trip to ${destination} for ${totalDays} days requires a minimum budget of approximately [estimate] ${currency || 'USD'}. Your budget of ${budgetStr} is insufficient to cover basic travel costs.", "minimum_estimate": [number]}
- If the budget is tight but feasible, prioritize: budget airlines/trains, hostels/budget hotels, street food/local eateries, free attractions, walking/public transport.
- Include an estimated_cost_${(currency || 'USD').toLowerCase()} field for EACH item showing approximate cost.
- At the end, ensure total estimated costs stay within ${budgetStr}.` : ''}

Rules:
- Day 1 must start with a "departure" item from ${sourceCity || 'home city'} and an "arrival" item at ${destination}.
- Day 1 should include a "hotel_checkin" item${hotelName ? ` at ${hotelName}` : ''}.
- The last day must include a "hotel_checkout" and a "departure" back.
- Each day should have 4-6 activities including meals, sightseeing, and free time.
- Include realistic times and durations.
- Mark outdoor activities with is_outdoor: true.
${budgetStr ? '- Prefer budget-friendly options. Include cost-saving tips in descriptions.\n- Suggest free or low-cost alternatives where possible.' : ''}

Return a JSON array of items with these fields:
- day_number (integer, 1-based)
- item_type (one of: departure, arrival, hotel_checkin, hotel_checkout, activity, meal, transport, free_time)
- title (string)
- description (short string${budgetStr ? ', include cost-saving tips when relevant' : ''})
- location (string)
- start_time (HH:MM format, 24h)
- end_time (HH:MM format, 24h)
- duration_minutes (integer)
- is_outdoor (boolean)
- category (one of: general, sightseeing, food, shopping, nature, culture, entertainment, relaxation)
- sort_order (integer, sequential per day starting from 0)
${budgetStr ? `- estimated_cost (number, estimated cost in ${currency || 'USD'} for this activity, 0 for free activities)` : ''}

Return ONLY the JSON array, no markdown or explanation.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a travel planning expert. Return only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let generatedItems: any[];
    try {
      const parsed = JSON.parse(jsonStr);
      // Check for budget-too-low response
      if (parsed && !Array.isArray(parsed) && parsed.error === 'BUDGET_TOO_LOW') {
        return new Response(JSON.stringify({
          error: 'BUDGET_TOO_LOW',
          message: parsed.message,
          minimum_estimate: parsed.minimum_estimate
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      generatedItems = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.error('Failed to parse AI response:', jsonStr.substring(0, 500));
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalEstimatedCost = generatedItems.reduce((sum: number, item: any) => sum + (item.estimated_cost || 0), 0);

    const rows = generatedItems.map((item: any) => ({
      trip_id: tripId,
      user_id: user.id,
      day_number: item.day_number,
      item_type: item.item_type || 'activity',
      title: item.title,
      description: item.description || null,
      location: item.location || null,
      start_time: item.start_time || null,
      end_time: item.end_time || null,
      duration_minutes: item.duration_minutes || 60,
      is_outdoor: item.is_outdoor || false,
      category: item.category || 'general',
      sort_order: item.sort_order || 0,
      notes: item.estimated_cost ? `Estimated cost: ${currency || 'USD'} ${item.estimated_cost}` : null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('itinerary_items')
      .insert(rows)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save itinerary' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      items: inserted,
      count: inserted?.length || 0,
      total_estimated_cost: totalEstimatedCost,
      currency: currency || 'USD',
      budget: budget || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-itinerary error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
