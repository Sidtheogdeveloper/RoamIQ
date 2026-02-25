import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Footprints, Users, AlertTriangle, Loader2, ChevronDown, ChevronUp, Trash2, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ItineraryItem = Tables<'itinerary_items'>;

const BACKEND_URL = 'http://localhost:8002';

interface Props {
    destination: string;
    items: ItineraryItem[];
    tripStartDate?: string;
    selectedDay?: number;
    onElderlyModeChange?: (enabled: boolean) => void;
    onItemsChanged?: () => void;
}

interface ScoredActivity {
    name: string;
    crowd_score: number;
    walkability_score: number;
    accessibility_score: number;
    overall_score: number;
    recommendation: string;
    reasons: string[];
}

interface OptimizeResult {
    scored_activities: ScoredActivity[];
    suggestions: string[];
    overall_elderly_score: number;
}

// High-effort keywords for local detection (used when API is down)
const HIGH_EFFORT_KEYWORDS = [
    'hike', 'trek', 'climb', 'stairs', 'steep', 'trail', 'uphill',
    'adventure', 'sport', 'cycling', 'surf', 'diving', 'waterpark',
    'amusement', 'theme park', 'zip', 'rafting', 'bungee', 'paraglid',
];

const ElderlyModePanel = ({ destination, items, tripStartDate, selectedDay, onElderlyModeChange, onItemsChanged }: Props) => {
    const [elderlyMode, setElderlyMode] = useState(false);
    const [result, setResult] = useState<OptimizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [removedItems, setRemovedItems] = useState<string[]>([]);
    const [aiMessages, setAiMessages] = useState<string[]>([]);
    const { toast } = useToast();

    const toggleElderlyMode = async (enabled: boolean) => {
        setElderlyMode(enabled);
        onElderlyModeChange?.(enabled);

        if (enabled) {
            await analyzeForElderly();
        } else {
            setResult(null);
            setAiMessages([]);
            setRemovedItems([]);
        }
    };

    const analyzeForElderly = async () => {
        setLoading(true);
        setError(null);
        setAiMessages([]);
        try {
            const activities = items.map(i => {
                // Compute day_of_week from tripStartDate + day_number
                let dayOfWeek: number | null = null;
                if (tripStartDate && i.day_number) {
                    const start = new Date(tripStartDate);
                    start.setDate(start.getDate() + i.day_number - 1);
                    const jsDay = start.getDay();
                    dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
                }

                return {
                    title: i.title,
                    description: i.description || null,
                    location: i.location || null,
                    is_outdoor: i.is_outdoor || false,
                    duration_minutes: i.duration_minutes || 60,
                    category: i.item_type,
                    day_of_week: dayOfWeek,
                    start_time: i.start_time || null,
                };
            });

            let resp: Response;
            try {
                resp = await fetch(`${BACKEND_URL}/api/elderly/optimize-itinerary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination, activities }),
                });
            } catch {
                // Backend not running — use local scoring
                performLocalAnalysis();
                return;
            }

            if (!resp.ok) {
                performLocalAnalysis();
                return;
            }

            const data = await resp.json();

            // Check if BestTime API was configured
            if (data.api_configured === false) {
                // Still use the heuristic results from the backend
                setResult(data);
            } else {
                setResult(data);
            }

            // Generate AI messages for high-effort activities
            const messages: string[] = [];
            const risky = (data.scored_activities || []).filter((a: ScoredActivity) => a.overall_score < 45);
            if (risky.length > 0) {
                messages.push(`Found ${risky.length} activities that may be challenging for elderly travelers:`);
                risky.forEach((a: ScoredActivity) => {
                    messages.push(`  • "${a.name}" (score: ${Math.round(a.overall_score)}/100) — ${a.recommendation}. ${a.reasons.join('. ')}`);
                });
                messages.push('');
                messages.push('Click "Optimize" below to remove high-effort activities and keep only elderly-friendly ones.');
            } else {
                messages.push('Great news! All activities in your itinerary are suitable for elderly travelers.');
            }
            if (data.suggestions) {
                messages.push('');
                data.suggestions.forEach((s: string) => messages.push(s));
            }
            setAiMessages(messages);
        } catch (err: any) {
            performLocalAnalysis();
        } finally {
            setLoading(false);
        }
    };

    // Fallback: local analysis when backend is unavailable
    const performLocalAnalysis = () => {
        const messages: string[] = [];
        const riskyItems: { name: string; reason: string }[] = [];

        items.forEach(item => {
            const title = item.title.toLowerCase();
            const desc = (item.description || '').toLowerCase();
            const combined = `${title} ${desc}`;

            for (const keyword of HIGH_EFFORT_KEYWORDS) {
                if (combined.includes(keyword)) {
                    riskyItems.push({ name: item.title, reason: `Contains "${keyword}" — likely high physical effort` });
                    break;
                }
            }

            if (item.is_outdoor && (item.duration_minutes || 0) > 120) {
                if (!riskyItems.find(r => r.name === item.title)) {
                    riskyItems.push({ name: item.title, reason: 'Long outdoor activity (over 2 hours)' });
                }
            }

            if ((item.duration_minutes || 0) > 180) {
                if (!riskyItems.find(r => r.name === item.title)) {
                    riskyItems.push({ name: item.title, reason: `Very long duration (${item.duration_minutes} min) — plan rest breaks` });
                }
            }
        });

        if (riskyItems.length > 0) {
            messages.push(`Found ${riskyItems.length} activities that may be challenging for elderly travelers:`);
            riskyItems.forEach(r => {
                messages.push(`  • "${r.name}" — ${r.reason}`);
            });
            messages.push('');
            messages.push('Click "Optimize" below to remove these activities.');
        } else {
            messages.push('All activities appear suitable for elderly travelers.');
        }
        messages.push('');
        messages.push('Tips for elderly travelers:');
        messages.push('  • Schedule the most active items in the morning');
        messages.push('  • Plan 15-30 minute rest breaks between activities');
        messages.push('  • Prefer indoor, air-conditioned venues during peak heat');

        setAiMessages(messages);
        setLoading(false);
    };

    // Remove high-effort activities from the itinerary
    const optimizeItinerary = async () => {
        const toRemove: ItineraryItem[] = [];

        if (result) {
            // Use API scores
            const riskyNames = new Set(
                result.scored_activities
                    .filter(a => a.overall_score < 45)
                    .map(a => a.name.toLowerCase())
            );
            items.forEach(item => {
                if (riskyNames.has(item.title.toLowerCase())) {
                    toRemove.push(item);
                }
            });
        } else {
            // Use local detection
            items.forEach(item => {
                const combined = `${item.title} ${item.description || ''}`.toLowerCase();
                const isHighEffort = HIGH_EFFORT_KEYWORDS.some(kw => combined.includes(kw));
                const isLongOutdoor = item.is_outdoor && (item.duration_minutes || 0) > 120;
                if (isHighEffort || isLongOutdoor) {
                    toRemove.push(item);
                }
            });
        }

        if (toRemove.length === 0) {
            toast({
                title: 'Already optimized',
                description: 'No high-effort activities found to remove.',
            });
            return;
        }

        // Delete from Supabase
        const removeIds = toRemove.map(i => i.id);
        const { error: deleteError } = await supabase
            .from('itinerary_items')
            .delete()
            .in('id', removeIds);

        if (deleteError) {
            toast({
                title: 'Error',
                description: 'Failed to remove activities: ' + deleteError.message,
                variant: 'destructive',
            });
            return;
        }

        setRemovedItems(toRemove.map(i => i.title));

        // Update AI messages
        const newMessages = [
            `Removed ${toRemove.length} high-effort activities:`,
            ...toRemove.map(i => `  • "${i.title}" — removed from Day ${i.day_number}`),
            '',
            'Your itinerary is now optimized for elderly comfort!',
            '',
            'Suggestions for replacement activities:',
            `  • Visit a local cafe or tea house in ${destination}`,
            `  • Explore a museum or art gallery`,
            `  • Enjoy a scenic drive or boat ride`,
            `  • Visit a temple or cultural landmark with seating areas`,
        ];
        setAiMessages(newMessages);

        toast({
            title: 'Itinerary optimized',
            description: `Removed ${toRemove.length} high-effort activities for elderly comfort.`,
        });

        onItemsChanged?.();
    };

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-emerald-500';
        if (score >= 55) return 'text-sky-500';
        if (score >= 35) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 75) return 'bg-emerald-500';
        if (score >= 55) return 'bg-sky-500';
        if (score >= 35) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getRecBadge = (rec: string) => {
        switch (rec) {
            case 'Highly Recommended': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Suitable': return 'bg-sky-50 text-sky-700 border-sky-200';
            case 'Use Caution': return 'bg-amber-50 text-amber-700 border-amber-200';
            default: return 'bg-rose-50 text-rose-700 border-rose-200';
        }
    };

    const hasRiskyActivities = result
        ? result.scored_activities.some(a => a.overall_score < 45)
        : aiMessages.some(m => m.includes('challenging'));

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-card p-5 shadow-card"
        >
            {/* Header with toggle */}
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Heart className="h-4 w-4 text-rose-400" /> Elderly Mode
                </h3>
                <div className="flex items-center gap-2">
                    <Label htmlFor="elderly-toggle" className="text-xs text-muted-foreground">
                        {elderlyMode ? 'On' : 'Off'}
                    </Label>
                    <Switch
                        id="elderly-toggle"
                        checked={elderlyMode}
                        onCheckedChange={toggleElderlyMode}
                    />
                </div>
            </div>

            {!elderlyMode && (
                <p className="text-center text-xs text-muted-foreground py-3">
                    Enable elderly mode to get accessibility insights and auto-remove high-effort activities
                </p>
            )}

            {loading && (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">Analyzing accessibility...</span>
                </div>
            )}

            {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <AnimatePresence mode="wait">
                {elderlyMode && !loading && (aiMessages.length > 0 || result) && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {/* AI Messages */}
                        {aiMessages.length > 0 && (
                            <div className="rounded-lg bg-secondary/40 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                    <p className="text-xs font-semibold text-foreground">AI Analysis</p>
                                </div>
                                <div className="space-y-1">
                                    {aiMessages.map((msg, i) => (
                                        <p key={i} className={`text-[12px] leading-relaxed ${msg.startsWith('  •') ? 'text-muted-foreground pl-2' : msg === '' ? 'h-2' : 'text-foreground font-medium'}`}>
                                            {msg}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Removed items list */}
                        {removedItems.length > 0 && (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                                <p className="text-xs font-semibold text-emerald-700 mb-1">Removed Activities</p>
                                {removedItems.map((name, i) => (
                                    <p key={i} className="text-[11px] text-emerald-600 flex items-center gap-1">
                                        <Trash2 className="h-3 w-3" /> {name}
                                    </p>
                                ))}
                            </div>
                        )}

                        {/* Overall score */}
                        {result && (
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
                                            stroke={result.overall_elderly_score >= 60 ? '#10b981' : result.overall_elderly_score >= 40 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="3"
                                            strokeDasharray={`${result.overall_elderly_score}, 100`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <span className={`font-display text-base font-bold ${getScoreColor(result.overall_elderly_score)}`}>
                                        {Math.round(result.overall_elderly_score)}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-display text-sm font-semibold text-foreground">Elderly Score</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {result.overall_elderly_score >= 70 ? 'Well-suited for elderly travelers' : result.overall_elderly_score >= 50 ? 'Some activities need adjustments' : 'Significant modifications recommended'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Scored activities (compact) */}
                        {result && result.scored_activities.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activity Scores</p>
                                {result.scored_activities.map((act, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                    >
                                        <button
                                            onClick={() => setExpanded(expanded === act.name ? null : act.name)}
                                            className="flex w-full items-center justify-between rounded-lg bg-secondary/30 p-2.5 text-left hover:bg-secondary/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span className={`font-display text-sm font-bold ${getScoreColor(act.overall_score)}`}>
                                                    {Math.round(act.overall_score)}
                                                </span>
                                                <p className="text-xs font-medium text-foreground truncate">{act.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-2">
                                                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${getRecBadge(act.recommendation)}`}>
                                                    {act.recommendation}
                                                </span>
                                                {expanded === act.name ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {expanded === act.name && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-3 py-2 space-y-1.5">
                                                        <div className="grid grid-cols-3 gap-2 text-center">
                                                            <div>
                                                                <Users className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                                                                <p className={`font-display text-xs font-bold ${getScoreColor(act.crowd_score)}`}>{Math.round(act.crowd_score)}</p>
                                                                <p className="text-[9px] text-muted-foreground">Crowd</p>
                                                            </div>
                                                            <div>
                                                                <Footprints className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                                                                <p className={`font-display text-xs font-bold ${getScoreColor(act.walkability_score)}`}>{Math.round(act.walkability_score)}</p>
                                                                <p className="text-[9px] text-muted-foreground">Walk</p>
                                                            </div>
                                                            <div>
                                                                <Shield className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                                                                <p className={`font-display text-xs font-bold ${getScoreColor(act.accessibility_score)}`}>{Math.round(act.accessibility_score)}</p>
                                                                <p className="text-[9px] text-muted-foreground">Access</p>
                                                            </div>
                                                        </div>
                                                        {act.reasons.length > 0 && (
                                                            <ul className="space-y-0.5">
                                                                {act.reasons.map((r, j) => (
                                                                    <li key={j} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                                                        <span className="mt-0.5 shrink-0">
                                                                            {r.includes('!') || r.includes('Warning') ? <AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> : <span className="text-emerald-500">+</span>}
                                                                        </span>
                                                                        {r}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Optimize button */}
                        {hasRiskyActivities && removedItems.length === 0 && (
                            <Button
                                onClick={optimizeItinerary}
                                className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                                size="sm"
                            >
                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                Optimize — Remove High-Effort Activities
                            </Button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ElderlyModePanel;
