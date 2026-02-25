import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, AlertTriangle, CheckCircle, Loader2, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';

type ItineraryItem = Tables<'itinerary_items'>;

const BACKEND_URL = 'http://localhost:8000';

interface Props {
    destination: string;
    items: ItineraryItem[];
    selectedDay: number;
    tripStartDate: string;
}

interface CrowdAnalysis {
    activity: string;
    venue_name: string | null;
    busyness_at_planned_time: number | null;
    optimization_tip: string | null;
    is_predicted?: boolean;
    error?: string;
}

const CrowdInsightsPanel = ({ destination, items, selectedDay, tripStartDate }: Props) => {
    const [analysis, setAnalysis] = useState<CrowdAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analyzed, setAnalyzed] = useState(false);

    const dayItems = items
        .filter(i => i.day_number === selectedDay)
        .sort((a, b) => a.sort_order - b.sort_order);

    const getDayOfWeek = () => {
        const start = new Date(tripStartDate);
        start.setDate(start.getDate() + selectedDay - 1);
        const jsDay = start.getDay();
        return jsDay === 0 ? 6 : jsDay - 1;
    };

    const analyzeCrowdLevels = async () => {
        setLoading(true);
        setError(null);
        setAnalysis([]);
        try {
            const activities = dayItems
                .filter(i => i.location)
                .map(i => ({
                    title: i.title,
                    location: i.location,
                    start_time: i.start_time || null,
                    day_of_week: getDayOfWeek(),
                }));

            if (activities.length === 0) {
                setError('No activities with locations on this day.');
                setLoading(false);
                return;
            }

            let resp: Response;
            try {
                resp = await fetch(`${BACKEND_URL}/api/crowd/analyze-itinerary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination, activities }),
                });
            } catch (fetchErr) {
                setError('Cannot reach backend server. Is uvicorn running on port 8000?');
                setLoading(false);
                return;
            }

            if (!resp.ok) {
                const errorText = await resp.text().catch(() => 'Unknown error');
                setError(`Backend error (${resp.status}): ${errorText}`);
                setLoading(false);
                return;
            }

            const data = await resp.json();

            // Check if BestTime API was configured
            if (data.api_configured === false) {
                setError('BestTime API keys not configured. Add BESTTIME_API_KEY_PRIVATE and BESTTIME_API_KEY_PUBLIC to backend/.env');
                setLoading(false);
                return;
            }

            const results: CrowdAnalysis[] = (data.analysis || []).map((item: any) => ({
                activity: item.activity || 'Unknown',
                venue_name: item.venue_name || null,
                busyness_at_planned_time: typeof item.busyness_at_planned_time === 'number' ? item.busyness_at_planned_time : null,
                optimization_tip: item.optimization_tip || item.error || 'No data available',
                is_predicted: item.is_predicted || false,
                error: item.error || undefined,
            }));

            setAnalysis(results);
            setAnalyzed(true);
        } catch (err: any) {
            setError(err.message || 'Failed to analyze crowd levels');
        } finally {
            setLoading(false);
        }
    };

    const getBusynessColor = (pct: number | null) => {
        if (pct === null) return 'text-muted-foreground';
        if (pct <= 30) return 'text-emerald-500';
        if (pct <= 60) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getBusynessIcon = (pct: number | null) => {
        if (pct === null) return BarChart3;
        if (pct <= 30) return CheckCircle;
        if (pct <= 60) return AlertTriangle;
        return AlertTriangle;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-card p-5 shadow-card"
        >
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" /> Crowd Insights
                </h3>
                <Button
                    size="sm"
                    variant={analyzed ? 'outline' : 'default'}
                    onClick={analyzeCrowdLevels}
                    disabled={loading || dayItems.length === 0}
                    className="text-xs"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Analyzing...
                        </>
                    ) : analyzed ? (
                        'Refresh'
                    ) : (
                        <>
                            <BarChart3 className="mr-1 h-3 w-3" /> Analyze Day {selectedDay}
                        </>
                    )}
                </Button>
            </div>

            {error && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <p className="font-semibold">Error</p>
                    <p>{error}</p>
                </div>
            )}

            {!analyzed && !loading && !error && (
                <p className="text-center text-xs text-muted-foreground py-4">
                    Click "Analyze" to check crowd levels for Day {selectedDay} activities
                </p>
            )}

            <AnimatePresence mode="wait">
                {analyzed && analysis.length > 0 && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                    >
                        {analysis.map((item, i) => {
                            const BusyIcon = getBusynessIcon(item.busyness_at_planned_time);
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    className="rounded-lg bg-secondary/40 p-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-foreground truncate">{item.activity}</p>
                                                {item.is_predicted && (
                                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 whitespace-nowrap">
                                                        <TrendingUp className="h-2.5 w-2.5" /> Predicted
                                                    </span>
                                                )}
                                            </div>
                                            {item.venue_name && item.venue_name !== item.activity && (
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    Matched: {item.venue_name}
                                                </p>
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-1 ${getBusynessColor(item.busyness_at_planned_time)}`}>
                                            <BusyIcon className="h-4 w-4" />
                                            <span className="text-xs font-semibold whitespace-nowrap">
                                                {item.busyness_at_planned_time !== null && item.busyness_at_planned_time !== undefined
                                                    ? `${item.busyness_at_planned_time}%`
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    {item.busyness_at_planned_time !== null && item.busyness_at_planned_time !== undefined && (
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                            <div
                                                className={`h-full rounded-full transition-all ${item.busyness_at_planned_time <= 30
                                                    ? 'bg-emerald-500'
                                                    : item.busyness_at_planned_time <= 60
                                                        ? 'bg-amber-500'
                                                        : 'bg-rose-500'
                                                    }`}
                                                style={{ width: `${Math.min(item.busyness_at_planned_time, 100)}%` }}
                                            />
                                        </div>
                                    )}
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                        {item.optimization_tip || 'No crowd data available for this venue'}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default CrowdInsightsPanel;
