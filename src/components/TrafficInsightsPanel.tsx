import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Route, Zap, Loader2, CheckCircle2, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GeocodedItem, RouteData } from '@/hooks/useTripRoutes';

type ItineraryItem = Tables<'itinerary_items'>;

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface Props {
    items: ItineraryItem[];
    selectedDay: number;
    allGeocoded: GeocodedItem[];
    routeData?: RouteData;
    onItemsChanged?: () => void;
}

interface OptimalRouteResult {
    duration: number;
    distance: number;
    waypoints: { waypoint_index: number; trips_index: number; location: number[] }[];
}

const TrafficInsightsPanel = ({ items, selectedDay, allGeocoded, routeData, onItemsChanged }: Props) => {
    const [trafficMode, setTrafficMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [optimalResult, setOptimalResult] = useState<OptimalRouteResult | null>(null);
    const { toast } = useToast();

    const currentDayItems = useMemo(
        () => items.filter((i) => i.day_number === selectedDay).sort((a, b) => a.sort_order - b.sort_order),
        [items, selectedDay]
    );

    const currentDayGeocoded = useMemo(
        () => allGeocoded.filter((g) => g.day_number === selectedDay).sort((a, b) => a.sort_order - b.sort_order),
        [allGeocoded, selectedDay]
    );

    const analyzeTraffic = async () => {
        if (currentDayGeocoded.length < 3) {
            toast({
                title: 'Not enough stops',
                description: 'You need at least 3 places on this day to optimize the route.',
            });
            return;
        }

        if (!mapboxToken) {
            toast({
                title: 'Mapbox Error',
                description: 'Mapbox token is missing.',
                variant: 'destructive',
            });
            return;
        }

        // Mapbox Optimization API allows max 12 waypoints
        const pointsToOptimize = currentDayGeocoded.slice(0, 12);
        const coords = pointsToOptimize.map((g) => `${g.lng},${g.lat}`).join(';');

        setLoading(true);
        setOptimalResult(null);

        try {
            const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}?access_token=${mapboxToken}&source=first&destination=last&roundtrip=false`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
                setOptimalResult({
                    duration: Math.round(data.trips[0].duration / 60),
                    distance: Math.round(data.trips[0].distance / 1000 * 10) / 10,
                    waypoints: data.waypoints,
                });
            } else {
                throw new Error(data.message || 'Failed to optimize route');
            }
        } catch (err: any) {
            toast({
                title: 'Optimization failed',
                description: err.message || 'Could not calculate optimal route.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleTrafficMode = (enabled: boolean) => {
        setTrafficMode(enabled);
        if (enabled) {
            analyzeTraffic();
        } else {
            setOptimalResult(null);
        }
    };

    const applyOptimization = async () => {
        if (!optimalResult || currentDayGeocoded.length < 3) return;

        setLoading(true);
        try {
            // Create a map of index -> new sort order
            const pointsToOptimize = currentDayGeocoded.slice(0, 12);

            // Update the items in Supabase
            const updates = optimalResult.waypoints.map((wp) => {
                const originalIndex = wp.waypoint_index;
                const newOrder = wp.trips_index;
                const itemToUpdate = pointsToOptimize[originalIndex];

                return {
                    id: itemToUpdate.id,
                    sort_order: newOrder,
                };
            });

            // To avoid unique constraint issues if any, push them linearly.
            // Easiest is to execute individual updates securely since it's just a few items
            const updatePromises = updates.map((update) =>
                supabase
                    .from('itinerary_items')
                    .update({ sort_order: update.sort_order })
                    .eq('id', update.id)
            );

            const results = await Promise.all(updatePromises);
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                throw new Error('Failed to update some items.');
            }

            toast({
                title: 'Route Optimized! 🚗',
                description: 'Successfully reordered activities for maximum efficiency.',
            });

            setOptimalResult(null);
            setTrafficMode(false);
            onItemsChanged?.();

        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate scores
    let currentDriveTime = routeData?.duration_min || 0;
    let currentTrafficTime = routeData?.duration_traffic_min || 0;
    let currentDistance = routeData?.distance_km || 0;

    // Let's cap score at 100
    let routeEfficiencyScore = 0;
    let timeSaved = 0;
    let distanceSaved = 0;
    let trafficDelay = currentTrafficTime - currentDriveTime;

    if (optimalResult && currentDriveTime > 0) {
        timeSaved = Math.max(0, currentDriveTime - optimalResult.duration);
        distanceSaved = Math.max(0, currentDistance - optimalResult.distance);

        // Efficiency: (Optimal / Current) * 100
        // If we are already optimal, score is 100
        routeEfficiencyScore = Math.min(100, Math.round((optimalResult.duration / currentDriveTime) * 100));
    } else if (currentDriveTime > 0) {
        routeEfficiencyScore = 90; // Default high if we don't know optimum
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-500';
        if (score >= 70) return 'text-amber-500';
        return 'text-rose-500';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-card p-5 shadow-card border border-border mt-6 mb-6"
        >
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Car className="h-4 w-4 text-orange-500" /> Traffic Insights
                </h3>
                <div className="flex items-center gap-2">
                    <Label htmlFor="traffic-toggle" className="text-xs text-muted-foreground">
                        {trafficMode ? 'On' : 'Off'}
                    </Label>
                    <Switch
                        id="traffic-toggle"
                        checked={trafficMode}
                        onCheckedChange={toggleTrafficMode}
                    />
                </div>
            </div>

            {!trafficMode && (
                <p className="text-center text-xs text-muted-foreground py-3">
                    Enable Traffic Insights to analyze driving efficiency and automatically reorder stops to save time on the road.
                </p>
            )}

            {loading && (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500 mr-2" />
                    <span className="text-sm text-muted-foreground">Optimizing route...</span>
                </div>
            )}

            <AnimatePresence mode="wait">
                {trafficMode && !loading && optimalResult && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {/* Overall score */}
                        <div className="flex items-center gap-4 rounded-lg bg-secondary/40 p-4">
                            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="hsl(var(--secondary))"
                                        strokeWidth="3"
                                    />
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke={routeEfficiencyScore >= 90 ? '#10b981' : routeEfficiencyScore >= 70 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth="3"
                                        strokeDasharray={`${routeEfficiencyScore}, 100`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className={`font-display text-base font-bold ${getScoreColor(routeEfficiencyScore)}`}>
                                    {routeEfficiencyScore}
                                </span>
                            </div>
                            <div>
                                <p className="font-display text-sm font-semibold text-foreground">Efficiency Score</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {routeEfficiencyScore >= 90 ? 'Your route is highly efficient!' : routeEfficiencyScore >= 70 ? 'Some backtracking detected.' : 'Significant time wasted driving.'}
                                </p>
                            </div>
                        </div>

                        {/* Analysis details */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-secondary/20 border border-border p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-foreground">Traffic Delay</span>
                                </div>
                                <p className="text-xl font-display font-medium text-foreground">
                                    {trafficDelay > 0 ? `+${trafficDelay}` : '0'}<span className="text-sm text-muted-foreground ml-1">mins</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">Based on current traffic estimates</p>
                            </div>

                            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Route className="h-4 w-4 text-orange-600" />
                                    <span className="text-xs font-semibold text-orange-700">Optimization Potential</span>
                                </div>
                                <p className="text-xl font-display font-medium text-orange-700">
                                    {timeSaved}<span className="text-sm text-orange-600/70 ml-1">mins saved</span>
                                </p>
                                <p className="text-[10px] text-orange-600/70 mt-1">By removing backtracking</p>
                            </div>
                        </div>

                        {timeSaved > 5 ? (
                            <Button
                                onClick={applyOptimization}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                                size="sm"
                            >
                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                Auto-Optimize Itinerary
                            </Button>
                        ) : (
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <p className="text-xs font-medium text-emerald-700">
                                    Your itinerary is already optimally ordered! No changes needed.
                                </p>
                            </div>
                        )}

                    </motion.div>
                )}

                {trafficMode && !loading && !optimalResult && currentDayGeocoded.length < 3 && (
                    <div className="text-center py-4 text-sm text-muted-foreground flex flex-col items-center">
                        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2 opacity-50" />
                        <p>Not enough locations</p>
                        <p className="text-xs mt-1">Add at least 3 mapped activities to this day to optimize.</p>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default TrafficInsightsPanel;
