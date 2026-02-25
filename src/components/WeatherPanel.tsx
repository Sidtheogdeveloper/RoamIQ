import { motion } from 'framer-motion';
import { Cloud, Droplets, Wind, Thermometer } from 'lucide-react';
import type { WeatherCondition } from '@/data/mockData';

interface WeatherPanelProps {
  weather: WeatherCondition;
}

const conditionIcons: Record<string, string> = {
  sunny: '☀️',
  'partly-cloudy': '⛅',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
};

const WeatherPanel = ({ weather }: WeatherPanelProps) => {
  const rainAlert = weather.rainProbability > 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Cloud className="h-4 w-4" />
          Weather
        </h3>
        {rainAlert && (
          <span className="animate-pulse-soft rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
            Rain Alert
          </span>
        )}
      </div>

      <div className="mb-4 flex items-center gap-4">
        <span className="text-4xl">{conditionIcons[weather.condition]}</span>
        <div>
          <p className="font-display text-3xl font-bold text-foreground">{weather.temp}°C</p>
          <p className="text-sm text-muted-foreground">Feels like {weather.feelsLike}°C</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-secondary/60 p-2.5 text-center">
          <Droplets className="mx-auto mb-1 h-4 w-4 text-info" />
          <p className="text-xs text-muted-foreground">Rain</p>
          <p className="font-display text-sm font-semibold text-foreground">{weather.rainProbability}%</p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2.5 text-center">
          <Wind className="mx-auto mb-1 h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground">Wind</p>
          <p className="font-display text-sm font-semibold text-foreground">{weather.windSpeed} km/h</p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2.5 text-center">
          <Thermometer className="mx-auto mb-1 h-4 w-4 text-accent" />
          <p className="text-xs text-muted-foreground">Humidity</p>
          <p className="font-display text-sm font-semibold text-foreground">{weather.humidity}%</p>
        </div>
      </div>

      {/* Hourly forecast */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weather.hourlyForecast.map((h, i) => (
          <div
            key={i}
            className="flex min-w-[52px] flex-col items-center rounded-lg bg-secondary/40 px-2 py-2 text-center"
          >
            <p className="text-[10px] text-muted-foreground">{h.hour}</p>
            <span className="my-0.5 text-sm">{conditionIcons[h.condition] || '☁️'}</span>
            <p className="text-xs font-semibold text-foreground">{h.temp}°</p>
            {h.rainProb > 30 && (
              <p className="text-[10px] font-medium text-info">{h.rainProb}%</p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default WeatherPanel;
