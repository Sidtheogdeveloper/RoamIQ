import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, RefreshCw, Bell, Settings, Compass } from 'lucide-react';
import WeatherPanel from '@/components/WeatherPanel';
import TrafficPanel from '@/components/TrafficPanel';
import ActivityCard from '@/components/ActivityCard';
import SuggestionsPanel from '@/components/SuggestionsPanel';
import OverallScore from '@/components/OverallScore';
import {
  mockWeather,
  mockTraffic,
  mockActivities,
  mockSuggestions,
} from '@/data/mockData';

const Index = () => {
  const [activities] = useState(mockActivities);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
              <Compass className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">Pathwise</h1>
              <p className="text-xs text-muted-foreground">Smart Itinerary Optimizer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw className={`h-4.5 w-4.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Destination bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Barcelona, Spain</span>
          <span>·</span>
          <span>Feb 21, 2026</span>
          <span>·</span>
          <span>{activities.length} activities planned</span>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: Itinerary */}
          <div className="space-y-6">
            <OverallScore activities={activities} />

            <div>
              <h2 className="mb-4 font-display text-lg font-bold text-foreground">
                Today's Itinerary
              </h2>
              <div className="space-y-3">
                {activities.map((activity, i) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    index={i}
                    isOptimized={activity.score >= 85}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Conditions & Suggestions */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <WeatherPanel weather={mockWeather} />
            <TrafficPanel traffic={mockTraffic} />
            <SuggestionsPanel suggestions={mockSuggestions} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
