import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hotel, UtensilsCrossed, Landmark, Star, MapPin, Clock, Loader2, RefreshCw,
  Sparkles, DollarSign, TreePine, Ticket, ShoppingBag, Eye, Plus, Check,
  Navigation, Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const BACKEND_URL = 'http://localhost:8001';

interface RecommendationsPanelProps {
  destination: string;
  sourceCity?: string;
  tripDays: number;
  itineraryItems?: Tables<'itinerary_items'>[];
  tripId?: string;
  onAddToItinerary?: (rec: { title: string; description?: string; location?: string; duration?: string; category?: string }) => Promise<void>;
}

interface HotelRec {
  name: string; description: string; priceRange: string; rating: number;
  location: string; highlight: string; isIndoor: boolean;
}
interface RestaurantRec {
  name: string; description: string; cuisine: string; priceRange: string;
  rating: number; location: string; highlight: string; isIndoor: boolean;
}
interface AttractionRec {
  name: string; description: string; category: string; duration: string;
  rating: number; location: string; highlight: string; isIndoor: boolean; bestTime: string;
}

type Category = 'hotels' | 'restaurants' | 'attractions';

const categoryConfig: Record<Category, { icon: React.ElementType; label: string; color: string }> = {
  hotels: { icon: Hotel, label: 'Hotels', color: 'text-primary' },
  restaurants: { icon: UtensilsCrossed, label: 'Restaurants', color: 'text-accent' },
  attractions: { icon: Landmark, label: 'Attractions', color: 'text-success' },
};

const attractionIcons: Record<string, React.ElementType> = {
  museum: Landmark, landmark: Landmark, nature: TreePine,
  entertainment: Ticket, market: ShoppingBag, viewpoint: Eye,
};

const RecommendationsPanel = ({ destination, sourceCity, tripDays, itineraryItems = [], tripId, onAddToItinerary }: RecommendationsPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category>('attractions');
  const [data, setData] = useState<{
    hotels?: HotelRec[]; restaurants?: RestaurantRec[]; attractions?: AttractionRec[];
  } | null>(null);

  // Foursquare state
  const [source, setSource] = useState<'ai' | 'foursquare'>('ai');
  const [fsqLoading, setFsqLoading] = useState(false);
  const [fsqData, setFsqData] = useState<Record<string, any[]> | null>(null);
  const [fsqCategory, setFsqCategory] = useState<string>('restaurants');
  const [routeInfo, setRouteInfo] = useState<{ distance_km?: number; sample_points?: number } | null>(null);

  // Build a set of existing itinerary item titles (lowercased) for filtering
  const existingTitles = useMemo(() => {
    return new Set(itineraryItems.map((item) => item.title.toLowerCase().trim()));
  }, [itineraryItems]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('get-recommendations', {
        body: { destination, tripDays, categories: ['hotels', 'restaurants', 'attractions'] },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      console.error('Recommendations error:', err);
      toast({ title: 'Failed to load recommendations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFoursquare = async () => {
    setFsqLoading(true);
    try {
      const endpoint = sourceCity
        ? `${BACKEND_URL}/api/foursquare/route-venues`
        : `${BACKEND_URL}/api/foursquare/nearby`;
      const body = sourceCity
        ? { source: sourceCity, destination, categories: ['hotels', 'restaurants', 'attractions'], interval_km: 50, limit_per_point: 3 }
        : { destination, categories: ['hotels', 'restaurants', 'attractions'], limit: 8 };
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error('Foursquare API error');
      const result = await resp.json();
      setFsqData(result.results || {});
      if (result.route_distance_km) {
        setRouteInfo({ distance_km: result.route_distance_km, sample_points: result.sample_points });
      }
    } catch (err: any) {
      console.error('Foursquare error:', err);
      toast({ title: 'Failed to load nearby places', description: err.message, variant: 'destructive' });
    } finally {
      setFsqLoading(false);
    }
  };

  useEffect(() => { fetchRecommendations(); }, [destination]);
  useEffect(() => { if (source === 'foursquare' && !fsqData) fetchFoursquare(); }, [source]);

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < Math.round(rating) ? 'fill-accent text-accent' : 'text-border'}`} />
      ))}
      <span className="ml-1 text-xs font-medium text-muted-foreground">{rating}</span>
    </div>
  );

  const renderPrice = (range: string) => (
    <span className="text-xs font-semibold text-success">{range}</span>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl bg-card py-20 shadow-card">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="font-display text-sm font-semibold text-foreground">Discovering {destination}</p>
          <p className="mt-1 text-xs text-muted-foreground">AI is curating personalized recommendations…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No recommendations available</p>
        <Button variant="outline" size="sm" onClick={fetchRecommendations}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try Again
        </Button>
      </div>
    );
  }

  // Filter out items that are already in the itinerary
  const rawItems = data[activeCategory] || [];
  const items = rawItems.filter((item: any) => !existingTitles.has(item.name.toLowerCase().trim()));
  const filteredCount = rawItems.length - items.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-accent" />
          Recommendations
        </h3>
        <Button variant="ghost" size="sm" onClick={source === 'ai' ? fetchRecommendations : fetchFoursquare} disabled={loading || fsqLoading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${(loading || fsqLoading) ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Source toggle: AI vs Foursquare */}
      <div className="flex gap-2">
        <button
          onClick={() => setSource('ai')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${source === 'ai' ? 'bg-accent text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> AI Picks
        </button>
        <button
          onClick={() => setSource('foursquare')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${source === 'foursquare' ? 'bg-blue-600 text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
        >
          <Navigation className="h-3.5 w-3.5" /> Nearby Places
          <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px]">Foursquare</span>
        </button>
      </div>

      {/* Category tabs — only for AI mode */}
      {source === 'ai' && (
        <>
          <div className="flex gap-2">
            {(Object.keys(categoryConfig) as Category[]).map((cat) => {
              const conf = categoryConfig[cat];
              const Icon = conf.icon;
              const allCatItems = data[cat] as any[] || [];
              const visibleCount = allCatItems.filter((item: any) => !existingTitles.has(item.name.toLowerCase().trim())).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {conf.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeCategory === cat ? 'bg-primary-foreground/20' : 'bg-card'
                    }`}>{visibleCount}</span>
                </button>
              );
            })}
          </div>

          {filteredCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {filteredCount} already in your itinerary (hidden)
            </p>
          )}

          {/* Cards */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {items.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center gap-2 py-8">
                  <p className="text-sm text-muted-foreground">All recommendations are already in your itinerary!</p>
                  <Button variant="outline" size="sm" onClick={fetchRecommendations}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Get More
                  </Button>
                </div>
              ) : items.map((item: any, i: number) => {
                const AttrIcon = activeCategory === 'attractions'
                  ? (attractionIcons[item.category] || Landmark)
                  : categoryConfig[activeCategory].icon;

                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group rounded-xl bg-card p-4 shadow-card transition-shadow hover:shadow-elevated"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg bg-secondary p-2 ${categoryConfig[activeCategory].color}`}>
                          <AttrIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" /> {item.location}
                          </div>
                        </div>
                      </div>
                      {renderPrice(item.priceRange)}
                    </div>

                    <p className="mb-2 text-xs text-muted-foreground">{item.description}</p>

                    <div className="mb-2 flex items-center gap-3">
                      {renderStars(item.rating)}
                      {item.duration && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" /> {item.duration}
                        </span>
                      )}
                      {item.cuisine && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {item.cuisine}
                        </span>
                      )}
                      {item.bestTime && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Best: {item.bestTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5">
                      <Sparkles className="h-3 w-3 text-accent" />
                      <span className="text-[11px] font-medium text-foreground">{item.highlight}</span>
                    </div>

                    {onAddToItinerary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2.5 w-full gap-1.5 text-xs"
                        disabled={addingItems.has(item.name)}
                        onClick={async () => {
                          setAddingItems((prev) => new Set(prev).add(item.name));
                          try {
                            await onAddToItinerary({
                              title: item.name,
                              description: item.description,
                              location: item.location,
                              duration: item.duration,
                              category: activeCategory === 'restaurants' ? 'restaurants' : activeCategory === 'hotels' ? 'hotel_checkin' : 'activity',
                            });
                          } finally {
                            setAddingItems((prev) => {
                              const next = new Set(prev);
                              next.delete(item.name);
                              return next;
                            });
                          }
                        }}
                      >
                        {addingItems.has(item.name) ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Adding…</>
                        ) : (
                          <><Plus className="h-3 w-3" /> Add to Itinerary</>
                        )}
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* Foursquare section */}
      {source === 'foursquare' && (
        <div className="space-y-4">
          {/* Foursquare category tabs */}
          <div className="flex gap-2">
            {['restaurants', 'hotels', 'attractions'].map((cat) => {
              const icons: Record<string, React.ElementType> = { restaurants: UtensilsCrossed, hotels: Hotel, attractions: Landmark };
              const CIcon = icons[cat] || Landmark;
              const count = (fsqData?.[cat] || []).length;
              return (
                <button
                  key={cat}
                  onClick={() => setFsqCategory(cat)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${fsqCategory === cat ? 'bg-blue-600 text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                >
                  <CIcon className="h-3.5 w-3.5" />
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${fsqCategory === cat ? 'bg-white/20' : 'bg-card'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {routeInfo && routeInfo.distance_km && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Navigation className="h-3.5 w-3.5" />
              <span className="font-medium">Route: {routeInfo.distance_km} km</span>
              <span className="text-blue-500">•</span>
              <span>{routeInfo.sample_points} stops searched along the way</span>
            </div>
          )}

          {fsqLoading ? (
            <div className="flex flex-col items-center gap-4 rounded-xl bg-card py-16 shadow-card">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <div className="text-center">
                <p className="font-display text-sm font-semibold text-foreground">Searching {destination}</p>
                <p className="mt-1 text-xs text-muted-foreground">Finding real venues via Foursquare…</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={fsqCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid gap-3 sm:grid-cols-2"
              >
                {(fsqData?.[fsqCategory] || []).length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center gap-2 py-8">
                    <Globe className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No venues found nearby</p>
                    <Button variant="outline" size="sm" onClick={fetchFoursquare}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try Again
                    </Button>
                  </div>
                ) : (fsqData?.[fsqCategory] || []).map((venue: any, i: number) => (
                  <motion.div
                    key={venue.fsq_id || i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group rounded-xl bg-card p-4 shadow-card transition-shadow hover:shadow-elevated"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                          {fsqCategory === 'restaurants' ? <UtensilsCrossed className="h-4 w-4" /> : fsqCategory === 'hotels' ? <Hotel className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{venue.name}</h4>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" /> {venue.address || venue.locality || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      {venue.price && (
                        <span className="text-xs font-semibold text-success">{'$'.repeat(venue.price)}</span>
                      )}
                    </div>

                    <div className="mb-2 flex items-center gap-3">
                      {venue.rating && (
                        <div className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-medium text-foreground">{(venue.rating / 2).toFixed(1)}</span>
                        </div>
                      )}
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {venue.category}
                      </span>
                    </div>

                    {venue.tip && (
                      <p className="mb-2 text-xs text-muted-foreground italic">&ldquo;{venue.tip}&rdquo;</p>
                    )}

                    <div className="flex items-center gap-1.5 rounded-lg bg-blue-500/5 px-2.5 py-1.5">
                      <Navigation className="h-3 w-3 text-blue-500" />
                      <span className="text-[10px] font-medium text-blue-700">Verified on Foursquare</span>
                    </div>

                    {onAddToItinerary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2.5 w-full gap-1.5 text-xs"
                        disabled={addingItems.has(venue.name)}
                        onClick={async () => {
                          setAddingItems((prev) => new Set(prev).add(venue.name));
                          try {
                            await onAddToItinerary({
                              title: venue.name,
                              description: venue.tip || `${venue.category} in ${venue.locality || destination}`,
                              location: venue.address || venue.locality,
                              category: fsqCategory === 'restaurants' ? 'restaurants' : fsqCategory === 'hotels' ? 'hotel_checkin' : 'activity',
                            });
                          } finally {
                            setAddingItems((prev) => {
                              const next = new Set(prev);
                              next.delete(venue.name);
                              return next;
                            });
                          }
                        }}
                      >
                        {addingItems.has(venue.name) ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Adding…</>
                        ) : (
                          <><Plus className="h-3 w-3" /> Add to Itinerary</>
                        )}
                      </Button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
};

export default RecommendationsPanel;
