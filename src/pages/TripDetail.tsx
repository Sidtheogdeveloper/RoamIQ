import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Calendar, Cloud, Plane, Hotel,
  ChevronLeft, ChevronRight, Droplets, Wind, Thermometer, Loader2, Map as MapIcon, Compass, LayoutList,
  DollarSign, TrendingDown, ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, addDays } from 'date-fns';
import AddItineraryItemDialog from '@/components/AddItineraryItemDialog';
import EditItineraryItemDialog from '@/components/EditItineraryItemDialog';
import TripItineraryView from '@/components/TripItineraryView';
import TripMapView from '@/components/TripMapView';
import RecommendationsPanel from '@/components/RecommendationsPanel';
import AdaptiveEnginePanel from '@/components/AdaptiveEnginePanel';
import CrowdInsightsPanel from '@/components/CrowdInsightsPanel';
import ElderlyModePanel from '@/components/ElderlyModePanel';
import ChildModePanel from '@/components/ChildModePanel';
import TrafficInsightsPanel from '@/components/TrafficInsightsPanel';
import TripChatbot from '@/components/TripChatbot';
import EmergencySOSPanel from '@/components/EmergencySOSPanel';
import { useTripRoutes } from '@/hooks/useTripRoutes';

type Trip = Tables<'trips'>;
type ItineraryItem = Tables<'itinerary_items'>;

const conditionIcons: Record<string, string> = {
  sunny: '☀️', 'partly-cloudy': '⛅', cloudy: '☁️', rainy: '🌧️', stormy: '⛈️',
};

interface WeatherData {
  temp: number;
  feelsLike: number;
  condition: string;
  rainProbability: number;
  humidity: number;
  windSpeed: number;
  description: string;
  hourlyForecast: { hour: string; temp: number; rainProb: number; condition: string }[];
  dailyForecast: { date: string; tempMin: number; tempMax: number; condition: string; rainProb: number }[];
  city: string;
}

const TripDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [lastDeletedItem, setLastDeletedItem] = useState<ItineraryItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);

  const { allGeocoded, dayRoutes, tripStats, loading: routesLoading } = useTripRoutes(items, trip?.destination);

  const totalDays = useMemo(() => {
    if (!trip) return 1;
    return Math.max(1, differenceInDays(new Date(trip.end_date), new Date(trip.start_date)) + 1);
  }, [trip]);

  const dayDate = useMemo(() => {
    if (!trip) return '';
    return format(addDays(new Date(trip.start_date), selectedDay - 1), 'EEE, MMM d');
  }, [trip, selectedDay]);

  useEffect(() => {
    if (id) { fetchTrip(); fetchItems(); }
  }, [id]);

  useEffect(() => {
    if (trip?.destination) fetchWeather();
  }, [trip?.destination]);

  const fetchTrip = async () => {
    const { data, error } = await supabase.from('trips').select('*').eq('id', id!).single();
    if (error) { toast({ title: 'Trip not found', variant: 'destructive' }); navigate('/trips'); }
    else setTrip(data);
    setLoading(false);
  };

  const fetchItems = async () => {
    const { data } = await supabase.from('itinerary_items').select('*').eq('trip_id', id!).order('day_number').order('sort_order');
    setItems(data || []);
  };

  const fetchWeather = async () => {
    if (!trip?.destination) return;
    setWeatherLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', { body: { destination: trip.destination } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWeather(data);
    } catch (err: any) { console.error('Weather fetch error:', err); }
    finally { setWeatherLoading(false); }
  };

  const deleteItem = async (itemId: string) => {
    const deletedItem = items.find((i) => i.id === itemId);
    const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast({ title: 'Item removed' });
      if (deletedItem) setLastDeletedItem(deletedItem);
    }
  };

  const handleEditItem = (item: ItineraryItem) => {
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const toggleItemComplete = async (itemId: string, isCompleted: boolean, actualCost: number | null) => {
    const { error } = await supabase.from('itinerary_items').update({
      is_completed: isCompleted,
      actual_cost: isCompleted ? actualCost : null,
    }).eq('id', itemId);
    if (error) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    } else {
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, is_completed: isCompleted, actual_cost: isCompleted ? actualCost : null } : i));
    }
  };

  const addSuggestionToItinerary = async (suggestion: {
    title: string;
    description?: string;
    suggestedTime?: string;
    suggestedDuration?: number;
    alternativeActivity?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }

    const activityTitle = suggestion.alternativeActivity || suggestion.title;
    const { error } = await supabase.from('itinerary_items').insert({
      trip_id: trip!.id,
      user_id: user.id,
      day_number: selectedDay,
      item_type: 'activity',
      title: activityTitle,
      description: suggestion.description || null,
      start_time: suggestion.suggestedTime || null,
      duration_minutes: suggestion.suggestedDuration || 60,
      is_outdoor: false,
      sort_order: Date.now() % 2147483647,
    });

    if (error) {
      toast({ title: 'Failed to add', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Added "${activityTitle}" to Day ${selectedDay}` });
      fetchItems();
      setLastDeletedItem(null);
    }
  };

  const addRecommendationToItinerary = async (rec: {
    title: string;
    description?: string;
    location?: string;
    duration?: string;
    category?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }

    // Smart scheduling: find the day with fewest items
    const dayCounts: Record<number, number> = {};
    for (let d = 1; d <= totalDays; d++) dayCounts[d] = 0;
    items.forEach((it) => { if (dayCounts[it.day_number] !== undefined) dayCounts[it.day_number]++; });
    const bestDay = Object.entries(dayCounts).sort(([, a], [, b]) => a - b)[0];
    const targetDay = bestDay ? parseInt(bestDay[0]) : 1;

    // Find next available time slot on that day
    const dayItems = items.filter((i) => i.day_number === targetDay).sort((a, b) => a.sort_order - b.sort_order);
    let startTime = '10:00';
    if (dayItems.length > 0) {
      const lastItem = dayItems[dayItems.length - 1];
      if (lastItem.end_time) {
        const [h, m] = lastItem.end_time.split(':').map(Number);
        const newMinutes = (h * 60 + m) + 30; // 30 min gap
        startTime = `${String(Math.floor(newMinutes / 60)).padStart(2, '0')}:${String(newMinutes % 60).padStart(2, '0')}`;
      } else if (lastItem.start_time) {
        const [h, m] = lastItem.start_time.split(':').map(Number);
        const dur = lastItem.duration_minutes || 60;
        const newMinutes = (h * 60 + m) + dur + 30;
        startTime = `${String(Math.floor(newMinutes / 60)).padStart(2, '0')}:${String(newMinutes % 60).padStart(2, '0')}`;
      }
    }

    // Parse duration (e.g. "2-3 hours" → 150, "1 hour" → 60, "45 min" → 45)
    let durationMin = 60;
    if (rec.duration) {
      const hourMatch = rec.duration.match(/(\d+)(?:\s*-\s*(\d+))?\s*hour/i);
      const minMatch = rec.duration.match(/(\d+)\s*min/i);
      if (hourMatch) {
        const low = parseInt(hourMatch[1]);
        const high = hourMatch[2] ? parseInt(hourMatch[2]) : low;
        durationMin = Math.round(((low + high) / 2) * 60);
      } else if (minMatch) {
        durationMin = parseInt(minMatch[1]);
      }
    }

    const [sh, sm] = startTime.split(':').map(Number);
    const endMinutes = sh * 60 + sm + durationMin;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const { error } = await supabase.from('itinerary_items').insert({
      trip_id: trip!.id,
      user_id: user.id,
      day_number: targetDay,
      item_type: rec.category === 'restaurant' || rec.category === 'restaurants' ? 'meal' : 'activity',
      title: rec.title,
      description: rec.description || null,
      location: rec.location || null,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMin,
      is_outdoor: false,
      sort_order: Date.now() % 2147483647,
    });

    if (error) {
      toast({ title: 'Failed to add', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Added "${rec.title}" to Day ${targetDay} at ${startTime}` });
      fetchItems();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trip) return null;

  const dailyWeather = weather?.dailyForecast?.find((d) => {
    const tripDayDate = format(addDays(new Date(trip.start_date), selectedDay - 1), 'yyyy-MM-dd');
    return d.date === tripDayDate;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="relative h-56 overflow-hidden bg-gradient-hero sm:h-64">
        <img
          src={`https://source.unsplash.com/1200x400/?${encodeURIComponent(trip.destination)},travel,landmark`}
          alt={trip.destination}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-between px-4 py-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="w-fit text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="pb-2">
            <h1 className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl">{trip.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-primary-foreground/70">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{trip.destination}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}</span>
              {trip.source_city && <span className="flex items-center gap-1"><Plane className="h-3.5 w-3.5" />From {trip.source_city}</span>}
              {trip.hotel_name && <span className="flex items-center gap-1"><Hotel className="h-3.5 w-3.5" />{trip.hotel_name}</span>}
              {(trip as any).budget && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{(trip as any).currency || 'USD'} {Number((trip as any).budget).toLocaleString()} budget</span>}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-5 bg-secondary">
            <TabsTrigger value="itinerary" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <LayoutList className="h-3.5 w-3.5" /> Itinerary
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MapIcon className="h-3.5 w-3.5" /> Map
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Compass className="h-3.5 w-3.5" /> Explore
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Cloud className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="emergency" className="flex items-center gap-1.5 text-xs sm:text-sm text-red-500 data-[state=active]:text-red-600">
              <ShieldAlert className="h-3.5 w-3.5" /> SOS
            </TabsTrigger>
          </TabsList>

          {/* Day selector (shared across itinerary + map) */}
          {(activeTab === 'itinerary' || activeTab === 'map') && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" disabled={selectedDay <= 1} onClick={() => setSelectedDay((d) => d - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <h2 className="font-display text-lg font-bold text-foreground">Day {selectedDay}</h2>
                  <p className="text-xs text-muted-foreground">{dayDate}</p>
                </div>
                <Button variant="outline" size="icon" disabled={selectedDay >= totalDays} onClick={() => setSelectedDay((d) => d + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Day pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                  const count = items.filter((it) => it.day_number === day).length;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`flex min-w-[48px] flex-col items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors ${selectedDay === day
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                        }`}
                    >
                      <span className="text-[10px] uppercase">Day</span>
                      <span className="font-display text-sm font-bold">{day}</span>
                      {count > 0 && <span className="mt-0.5 text-[10px] opacity-70">{count} items</span>}
                    </button>
                  );
                })}
              </div>

              {/* Daily weather badge */}
              {dailyWeather && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-card">
                  <span className="text-2xl">{conditionIcons[dailyWeather.condition] || '☁️'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{dailyWeather.tempMin}° – {dailyWeather.tempMax}°C</p>
                    <p className="text-xs text-muted-foreground capitalize">{dailyWeather.condition.replace('-', ' ')}</p>
                  </div>
                  {dailyWeather.rainProb > 30 && (
                    <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                      {dailyWeather.rainProb}% rain
                    </span>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* TAB: Itinerary */}
          <TabsContent value="itinerary">
            <div className="space-y-6">
              {/* Itinerary timeline */}
              <TripItineraryView
                items={items}
                selectedDay={selectedDay}
                startDate={trip.start_date}
                onDeleteItem={deleteItem}
                onEditItem={handleEditItem}
                onAddItem={() => setDialogOpen(true)}
                onToggleComplete={toggleItemComplete}
              />

              {/* Full-width insight panels — horizontal grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <WeatherPanel weather={weather} weatherLoading={weatherLoading} destination={trip.destination} />
                <AdaptiveEnginePanel
                  destination={trip.destination}
                  weather={weather}
                  items={items}
                  selectedDay={selectedDay}
                  deletedItem={lastDeletedItem}
                  onAddSuggestion={addSuggestionToItinerary}
                  routeData={dayRoutes[selectedDay]}
                />
                <CrowdInsightsPanel
                  destination={trip.destination}
                  items={items}
                  selectedDay={selectedDay}
                  tripStartDate={trip.start_date}
                />
                <ElderlyModePanel
                  destination={trip.destination}
                  items={items}
                  tripStartDate={trip.start_date}
                  selectedDay={selectedDay}
                  onItemsChanged={fetchItems}
                />
                <ChildModePanel
                  destination={trip.destination}
                  items={items.filter(i => i.day_number === selectedDay)}
                  tripStartDate={trip.start_date}
                  selectedDay={selectedDay}
                  onItemsChanged={fetchItems}
                />
                <TrafficInsightsPanel
                  items={items}
                  selectedDay={selectedDay}
                  allGeocoded={allGeocoded}
                  routeData={dayRoutes[selectedDay]}
                  onItemsChanged={fetchItems}
                />
                <TripSummaryPanel totalDays={totalDays} itemCount={items.length} status={trip.status} budget={(trip as any).budget} currency={(trip as any).currency || 'USD'} items={items} />
              </div>
            </div>
          </TabsContent>

          {/* TAB: Map */}
          <TabsContent value="map">
            <TripMapView
              items={items}
              destination={trip.destination}
              selectedDay={selectedDay}
              allGeocoded={allGeocoded}
              dayRoutes={dayRoutes}
              tripStats={tripStats}
              loading={routesLoading}
            />
          </TabsContent>

          {/* TAB: Recommendations */}
          <TabsContent value="recommendations">
            <RecommendationsPanel destination={trip.destination} sourceCity={(trip as any).source_city || ''} tripDays={totalDays} itineraryItems={items} tripId={trip.id} onAddToItinerary={addRecommendationToItinerary} />
          </TabsContent>

          {/* TAB: Overview */}
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <WeatherPanel weather={weather} weatherLoading={weatherLoading} destination={trip.destination} />
              <TripSummaryPanel totalDays={totalDays} itemCount={items.length} status={trip.status} budget={(trip as any).budget} currency={(trip as any).currency || 'USD'} items={items} />
            </div>
          </TabsContent>

          {/* TAB: Emergency SOS */}
          <TabsContent value="emergency">
            <EmergencySOSPanel destination={trip.destination} />
          </TabsContent>
        </Tabs>
      </main>

      <TripChatbot destination={trip.destination} items={items} />

      <AddItineraryItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tripId={trip.id}
        dayNumber={selectedDay}
        onCreated={fetchItems}
      />
      <EditItineraryItemDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={editingItem}
        onUpdated={fetchItems}
      />
    </div>
  );
};

/* ---------- Sub-components ---------- */

const WeatherPanel = ({ weather, weatherLoading, destination }: { weather: WeatherData | null; weatherLoading: boolean; destination: string }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-card p-5 shadow-card">
    <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      <Cloud className="h-4 w-4" /> Weather in {destination}
    </h3>
    {weatherLoading ? (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ) : weather ? (
      <>
        <div className="mb-4 flex items-center gap-4">
          <span className="text-4xl">{conditionIcons[weather.condition] || '☁️'}</span>
          <div>
            <p className="font-display text-3xl font-bold text-foreground">{weather.temp}°C</p>
            <p className="text-sm text-muted-foreground capitalize">{weather.description}</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-secondary/60 p-2 text-center">
            <Droplets className="mx-auto mb-1 h-3.5 w-3.5 text-info" />
            <p className="text-[10px] text-muted-foreground">Rain</p>
            <p className="font-display text-sm font-semibold text-foreground">{weather.rainProbability}%</p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-2 text-center">
            <Wind className="mx-auto mb-1 h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] text-muted-foreground">Wind</p>
            <p className="font-display text-sm font-semibold text-foreground">{weather.windSpeed} km/h</p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-2 text-center">
            <Thermometer className="mx-auto mb-1 h-3.5 w-3.5 text-accent" />
            <p className="text-[10px] text-muted-foreground">Humidity</p>
            <p className="font-display text-sm font-semibold text-foreground">{weather.humidity}%</p>
          </div>
        </div>
        {weather.dailyForecast && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">5-Day Forecast</p>
            {weather.dailyForecast.map((day, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2.5 py-2">
                <span className="w-16 text-xs text-muted-foreground">{format(new Date(day.date), 'EEE d')}</span>
                <span className="text-sm">{conditionIcons[day.condition] || '☁️'}</span>
                <div className="flex-1">
                  <div className="h-1 flex-1 rounded-full bg-border">
                    <div className="h-1 rounded-full bg-primary" style={{ width: `${Math.min(100, (day.tempMax / 45) * 100)}%` }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-foreground">{day.tempMin}°/{day.tempMax}°</span>
                {day.rainProb > 30 && <span className="text-[10px] text-info">{day.rainProb}%</span>}
              </div>
            ))}
          </div>
        )}
      </>
    ) : (
      <p className="py-4 text-center text-sm text-muted-foreground">Weather data unavailable</p>
    )}
  </motion.div>
);


const TripSummaryPanel = ({ totalDays, itemCount, status, budget, currency, items }: { totalDays: number; itemCount: number; status: string; budget?: number; currency: string; items: ItineraryItem[] }) => {
  // Parse estimated costs from notes field
  const totalEstimated = items.reduce((sum, item) => {
    const match = item.notes?.match(/Estimated cost: \w+ (\d+(?:\.\d+)?)/);
    return sum + (match ? parseFloat(match[1]) : 0);
  }, 0);

  // Sum actual costs from completed items
  const totalActual = items.reduce((sum, item) => {
    return sum + (item.is_completed && item.actual_cost ? item.actual_cost : 0);
  }, 0);
  const completedCount = items.filter((i) => i.is_completed).length;

  // Use actual spending as primary if any, else fall back to estimated
  const primarySpend = totalActual > 0 ? totalActual : totalEstimated;
  const budgetUsedPercent = budget ? Math.min(100, (primarySpend / budget) * 100) : 0;
  const isOverBudget = budget ? primarySpend > budget : false;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl bg-card p-5 shadow-card">
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trip Summary</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium text-foreground">{totalDays} days</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Activities</span><span className="font-medium text-foreground">{itemCount}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium text-success">{completedCount} / {itemCount}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize text-foreground">{status}</span></div>
      </div>

      {budget && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
            <DollarSign className="h-4 w-4 text-primary" /> Budget Tracker
          </h4>
          <div className="space-y-1.5">
            {totalEstimated > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Estimated spend</span>
                <span className="font-semibold text-muted-foreground">
                  {currency} {totalEstimated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            {totalActual > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Actual spend</span>
                <span className={`font-semibold ${isOverBudget ? 'text-destructive' : 'text-success'}`}>
                  {currency} {totalActual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            <Progress value={budgetUsedPercent} className={`h-2 ${isOverBudget ? '[&>div]:bg-destructive' : totalActual > 0 ? '[&>div]:bg-success' : ''}`} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{currency} {budget.toLocaleString()}</span>
            </div>
          </div>
          {isOverBudget && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              <span>Over budget by {currency} {(primarySpend - budget).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          )}
          {!isOverBudget && primarySpend > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-2.5 text-xs text-primary">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />
              <span>{currency} {(budget - primarySpend).toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default TripDetail;
