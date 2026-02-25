import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, lat, lng } = await req.json();
    const apiKey = Deno.env.get('OPENWEATHERMAP_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenWeatherMap API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let weatherUrl: string;

    if (lat && lng) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;
    } else if (destination) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(destination)}&units=metric&appid=${apiKey}`;
    } else {
      return new Response(JSON.stringify({ error: 'Provide destination or lat/lng' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    if (!weatherRes.ok) {
      return new Response(JSON.stringify({ error: weatherData.message || 'Weather API error' }), {
        status: weatherRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform to our format
    const current = weatherData.list[0];
    const conditionMap: Record<string, string> = {
      Clear: 'sunny',
      Clouds: 'cloudy',
      Rain: 'rainy',
      Drizzle: 'rainy',
      Thunderstorm: 'stormy',
      Snow: 'cloudy',
      Mist: 'cloudy',
      Fog: 'cloudy',
      Haze: 'partly-cloudy',
    };

    const mainCondition = current.weather[0].main;
    const condition = conditionMap[mainCondition] || 'partly-cloudy';

    // Build hourly forecast from 3-hour intervals
    const hourlyForecast = weatherData.list.slice(0, 8).map((item: any) => {
      const date = new Date(item.dt * 1000);
      const hour = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      const itemCondition = conditionMap[item.weather[0].main] || 'partly-cloudy';
      const rainProb = Math.round((item.pop || 0) * 100);

      return {
        hour,
        temp: Math.round(item.main.temp),
        rainProb,
        condition: itemCondition,
      };
    });

    // Build daily forecast
    const dailyMap: Record<string, any[]> = {};
    weatherData.list.forEach((item: any) => {
      const dateStr = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
      dailyMap[dateStr].push(item);
    });

    const dailyForecast = Object.entries(dailyMap).slice(0, 5).map(([date, items]) => {
      const temps = items.map((i: any) => i.main.temp);
      const maxRainProb = Math.max(...items.map((i: any) => Math.round((i.pop || 0) * 100)));
      const mostCommonCondition = items.reduce((acc: Record<string, number>, i: any) => {
        const c = conditionMap[i.weather[0].main] || 'partly-cloudy';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topCondition = Object.entries(mostCommonCondition).sort((a, b) => b[1] - a[1])[0][0];

      return {
        date,
        tempMin: Math.round(Math.min(...temps)),
        tempMax: Math.round(Math.max(...temps)),
        condition: topCondition,
        rainProb: maxRainProb,
      };
    });

    const result = {
      temp: Math.round(current.main.temp),
      feelsLike: Math.round(current.main.feels_like),
      condition,
      rainProbability: Math.round((current.pop || 0) * 100),
      humidity: current.main.humidity,
      windSpeed: Math.round(current.wind.speed * 3.6), // m/s to km/h
      icon: current.weather[0].icon,
      description: current.weather[0].description,
      hourlyForecast,
      dailyForecast,
      city: weatherData.city.name,
      country: weatherData.city.country,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
