import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, CloudRain, Clock, Shield, ArrowRightLeft, Check, X, ChevronRight,
  Loader2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RouteData } from '@/hooks/useTripRoutes';

type ItineraryItem = Tables<'itinerary_items'>;

interface AdaptiveEnginePanelProps {
  destination: string;
  weather: {
    temp: number; feelsLike: number; condition: string;
    rainProbability: number; humidity: number; windSpeed: number;
  } | null;
  items: ItineraryItem[];
  selectedDay: number;
  deletedItem?: ItineraryItem | null;
  onAddSuggestion?: (suggestion: {
    title: string;
    description?: string;
    suggestedTime?: string;
    suggestedDuration?: number;
    alternativeActivity?: string;
  }) => void;
  routeData?: RouteData;
}

interface AdaptiveSuggestion {
  id: string;
  type: 'indoor_alternative' | 'timing_change' | 'safety_warning' | 'activity_swap';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reason: string;
  impact: string;
  affectedActivity: string | null;
  alternativeActivity: string | null;
  suggestedTime?: string;
  suggestedDuration?: number;
}

const typeIcons: Record<string, React.ElementType> = {
  indoor_alternative: CloudRain,
  timing_change: Clock,
  safety_warning: Shield,
  activity_swap: ArrowRightLeft,
};

const priorityStyles: Record<string, string> = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-success',
};

const AdaptiveEnginePanel = ({ destination, weather, items, selectedDay, deletedItem, onAddSuggestion, routeData }: AdaptiveEnginePanelProps) => {
  const [suggestions, setSuggestions] = useState<AdaptiveSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rateLimited, setRateLimited] = useState(false);

  const dayItems = items.filter((i) => i.day_number === selectedDay);

  const fetchSuggestions = useCallback(async (deleted?: ItineraryItem | null) => {
    // For deletion mode, we don't need weather or existing day items
    if (deleted) {
      setLoading(true);
      setRateLimited(false);
      try {
        const { data, error } = await supabase.functions.invoke('get-adaptive-suggestions', {
          body: {
            destination,
            weather,
            itineraryItems: dayItems,
            deletedItem: deleted,
            allTripItems: items, // all items across all days
            routeData, // Included Mapbox route and traffic data
          },
        });
        if (error) {
          const errorMsg = typeof error === 'object' && error.message ? error.message : String(error);
          if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
            setRateLimited(true);
            toast.error('AI rate limit reached. Try again in a minute.');
            return;
          }
          throw error;
        }
        setSuggestions(data?.suggestions || []);
      } catch (err) {
        console.error('Adaptive suggestions error:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Weather mode
    if (!weather || dayItems.length === 0) {
      setSuggestions([]);
      return;
    }

    const hasOutdoorActivities = dayItems.some((i) => i.is_outdoor);
    const badWeather = weather.rainProbability > 30 || weather.condition === 'rainy' || weather.condition === 'stormy' || weather.windSpeed > 30;
    if (!hasOutdoorActivities && !badWeather) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setRateLimited(false);
    try {
      const { data, error } = await supabase.functions.invoke('get-adaptive-suggestions', {
        body: { destination, weather, itineraryItems: dayItems, allTripItems: items, routeData },
      });
      if (error) {
        const errorMsg = typeof error === 'object' && error.message ? error.message : String(error);
        if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
          setRateLimited(true);
          toast.error('AI rate limit reached. Try again in a minute.');
          return;
        }
        throw error;
      }
      setSuggestions(data?.suggestions || []);
    } catch (err) {
      console.error('Adaptive suggestions error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [destination, weather, dayItems, items]);

  // Trigger on deletion
  useEffect(() => {
    if (deletedItem) {
      setDismissed(new Set());
      setAccepted(new Set());
      fetchSuggestions(deletedItem);
    }
  }, [deletedItem]);

  // Trigger on weather/day change
  useEffect(() => {
    if (!deletedItem) {
      setDismissed(new Set());
      setAccepted(new Set());
      fetchSuggestions();
    }
  }, [weather?.condition, weather?.rainProbability, selectedDay, dayItems.length]);

  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  const hasFineWeather = weather && weather.rainProbability <= 30 && weather.condition !== 'rainy' && weather.condition !== 'stormy';

  // Determine the display message for the empty state
  let emptyStateMessage = 'Analyzing itinerary and weather impact...';
  if (deletedItem) {
    emptyStateMessage = 'No replacement suggestions available for this item.';
  } else if (!weather) {
    emptyStateMessage = 'Waiting for weather data to analyze itinerary...';
  } else if (dayItems.length === 0) {
    emptyStateMessage = 'Add activities to this day to get AI adaptive suggestions.';
  } else if (hasFineWeather) {
    emptyStateMessage = '🌤️ Weather looks clear! No adaptive changes needed right now.';
  } else if (suggestions.length > 0 && visible.length === 0) {
    emptyStateMessage = 'All suggestions handled ✓';
  } else {
    emptyStateMessage = 'Weather may impact outdoor activities. Analyzing...';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl bg-card p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-4 w-4 text-accent" />
          {deletedItem ? 'Replacement Suggestions' : 'Adaptive Engine'}
        </h3>
        <div className="flex items-center gap-2">
          {visible.length > 0 && (
            <span className="animate-pulse-soft rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
              {visible.length} suggestion{visible.length !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchSuggestions(deletedItem)} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {deletedItem ? 'Finding replacement activities…' : 'Analyzing weather impact…'}
        </div>
      ) : rateLimited ? (
        <div className="py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Rate limited — try refreshing in a minute.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-3 text-center border border-dashed border-border rounded-lg bg-secondary/30">
          <p className="text-xs text-muted-foreground">
            {emptyStateMessage}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {visible.map((suggestion) => {
              const Icon = typeIcons[suggestion.type] || Zap;
              const isAccepted = accepted.has(suggestion.id);

              return (
                <motion.div
                  key={suggestion.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className={`overflow-hidden rounded-lg border-l-[3px] bg-secondary/50 ${priorityStyles[suggestion.priority]}`}
                >
                  <div className="p-3">
                    <div className="mb-1.5 flex items-start gap-2">
                      <div className="mt-0.5 rounded-md bg-card p-1.5">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-foreground">{suggestion.title}</h4>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{suggestion.description}</p>
                      </div>
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded bg-card px-1.5 py-0.5 font-medium text-muted-foreground">
                        {suggestion.reason}
                      </span>
                      {suggestion.affectedActivity && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                          Replaces: {suggestion.affectedActivity}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                        <ChevronRight className="h-2.5 w-2.5" />
                        {suggestion.impact}
                      </span>

                      {!isAccepted ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setDismissed((s) => new Set([...s, suggestion.id]))}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (onAddSuggestion) {
                                onAddSuggestion({
                                  title: suggestion.title,
                                  description: suggestion.description,
                                  suggestedTime: suggestion.suggestedTime,
                                  suggestedDuration: suggestion.suggestedDuration,
                                  alternativeActivity: suggestion.alternativeActivity,
                                });
                                setAccepted((s) => new Set([...s, suggestion.id]));
                              } else {
                                setAccepted((s) => new Set([...s, suggestion.id]));
                              }
                            }}
                            className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                          >
                            + Add
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <Check className="h-2.5 w-2.5" /> Added
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default AdaptiveEnginePanel;