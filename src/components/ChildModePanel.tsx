import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Baby, Sparkles, Star, Loader2, ChevronDown, ChevronUp, Trash2, MessageSquare, Zap, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ItineraryItem = Tables<'itinerary_items'>;

const BACKEND_URL = 'http://localhost:8001';

interface Props {
    destination: string;
    items: ItineraryItem[];
    tripStartDate?: string;
    selectedDay?: number;
    onItemsChanged?: () => void;
}

interface ScoredActivity {
    name: string;
    fun_score: number;
    safety_score: number;
    engagement_score: number;
    overall_score: number;
    recommendation: string;
    emoji: string;
    reasons: string[];
    suggested_alternative: string | null;
}

interface OptimizeResult {
    scored_activities: ScoredActivity[];
    suggestions: string[];
    overall_child_score: number;
    kid_activity_suggestions: { title: string; description: string; duration: string; category: string }[];
}

// Keywords that are definitely not kid-friendly
const NOT_KID_FRIENDLY = [
    'bar', 'pub', 'nightclub', 'wine', 'brewery', 'cocktail',
    'spa', 'massage', 'meditation', 'yoga retreat',
];

const SUPER_FUN_KEYWORDS = [
    'amusement', 'theme park', 'zoo', 'aquarium', 'playground',
    'water park', 'beach', 'ice cream', 'toy', 'carnival',
    'arcade', 'trampoline', 'bowling', 'mini golf',
];

const ChildModePanel = ({ destination, items, tripStartDate, selectedDay, onItemsChanged }: Props) => {
    const [childMode, setChildMode] = useState(false);
    const [result, setResult] = useState<OptimizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [removedItems, setRemovedItems] = useState<string[]>([]);
    const [aiMessages, setAiMessages] = useState<string[]>([]);
    const { toast } = useToast();

    const toggleChildMode = async (enabled: boolean) => {
        setChildMode(enabled);
        if (enabled) {
            await analyzeForChildren();
        } else {
            setResult(null);
            setAiMessages([]);
            setRemovedItems([]);
        }
    };

    const analyzeForChildren = async () => {
        setLoading(true);
        setError(null);
        setAiMessages([]);
        try {
            const activities = items.map(i => ({
                title: i.title,
                description: i.description || null,
                location: i.location || null,
                is_outdoor: i.is_outdoor || false,
                duration_minutes: i.duration_minutes || 60,
                category: i.item_type,
            }));

            let resp: Response;
            try {
                resp = await fetch(`${BACKEND_URL}/api/child/optimize-itinerary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination, activities }),
                });
            } catch {
                performLocalAnalysis();
                return;
            }

            if (!resp.ok) {
                performLocalAnalysis();
                return;
            }

            const data = await resp.json();
            setResult(data);

            const messages: string[] = [];
            const boring = (data.scored_activities || []).filter((a: ScoredActivity) => a.overall_score < 40);
            const superFun = (data.scored_activities || []).filter((a: ScoredActivity) => a.overall_score >= 70);

            if (superFun.length > 0) {
                messages.push(`🎉 ${superFun.length} activities kids will absolutely love!`);
            }
            if (boring.length > 0) {
                messages.push(`😴 ${boring.length} activities might bore the kids:`);
                boring.forEach((a: ScoredActivity) => {
                    const alt = a.suggested_alternative ? ` → ${a.suggested_alternative}` : '';
                    messages.push(`  • "${a.name}" (fun: ${Math.round(a.fun_score)}/100)${alt}`);
                });
                messages.push('');
                messages.push('Click "Make it Fun!" to swap boring activities with kid-friendly ones!');
            } else {
                messages.push('🌟 Great news! Your itinerary is already awesome for kids!');
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

    const performLocalAnalysis = () => {
        const messages: string[] = [];
        const boringItems: { name: string; reason: string }[] = [];
        const funItems: string[] = [];

        items.forEach(item => {
            const text = `${item.title} ${item.description || ''}`.toLowerCase();

            if (SUPER_FUN_KEYWORDS.some(kw => text.includes(kw))) {
                funItems.push(item.title);
            } else if (NOT_KID_FRIENDLY.some(kw => text.includes(kw))) {
                boringItems.push({ name: item.title, reason: 'Not suitable for children' });
            } else if ((item.duration_minutes || 0) > 120) {
                boringItems.push({ name: item.title, reason: `Long duration (${item.duration_minutes} min) — kids get restless` });
            }
        });

        if (funItems.length > 0) {
            messages.push(`🎉 ${funItems.length} activities kids will love: ${funItems.join(', ')}`);
        }
        if (boringItems.length > 0) {
            messages.push(`😴 ${boringItems.length} activities to reconsider for kids:`);
            boringItems.forEach(r => messages.push(`  • "${r.name}" — ${r.reason}`));
            messages.push('');
            messages.push('Click "Make it Fun!" to remove these.');
        } else {
            messages.push('🌟 All activities look kid-friendly!');
        }

        messages.push('');
        messages.push('🍦 Pack plenty of snacks and drinks!');
        messages.push('📱 Bring coloring books and games for travel time.');
        messages.push('🧴 Don\'t forget sunscreen and hats for outdoor fun!');

        setAiMessages(messages);
        setLoading(false);
    };

    const makeFun = async () => {
        const toRemove: ItineraryItem[] = [];

        if (result) {
            const boringNames = new Set(
                result.scored_activities
                    .filter(a => a.overall_score < 40)
                    .map(a => a.name.toLowerCase())
            );
            items.forEach(item => {
                if (boringNames.has(item.title.toLowerCase())) {
                    toRemove.push(item);
                }
            });
        } else {
            items.forEach(item => {
                const text = `${item.title} ${item.description || ''}`.toLowerCase();
                if (NOT_KID_FRIENDLY.some(kw => text.includes(kw))) {
                    toRemove.push(item);
                }
            });
        }

        if (toRemove.length === 0) {
            toast({
                title: 'Already kid-friendly! 🎉',
                description: 'No boring activities found to replace.',
            });
            return;
        }

        const removeIds = toRemove.map(i => i.id);
        const { error: deleteError } = await supabase
            .from('itinerary_items')
            .delete()
            .in('id', removeIds);

        if (deleteError) {
            toast({ title: 'Error', description: deleteError.message, variant: 'destructive' });
            return;
        }

        setRemovedItems(toRemove.map(i => i.title));

        const newMessages = [
            `🎉 Removed ${toRemove.length} boring activities:`,
            ...toRemove.map(i => `  • "${i.title}" — bye bye! 👋`),
            '',
            '✨ Your trip is now way more fun for kids!',
            '',
            '🌟 Ideas to add instead:',
            `  • 🎢 Visit an amusement park in ${destination}`,
            `  • 🍦 Ice cream crawl — try every flavor!`,
            `  • 🏖️ Beach fun day with sandcastles`,
            `  • 🎨 Kids art or craft workshop`,
            `  • 🦁 Local zoo or animal encounter`,
        ];
        setAiMessages(newMessages);

        toast({ title: 'Made it fun! 🎉', description: `Removed ${toRemove.length} boring activities.` });
        onItemsChanged?.();
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-fuchsia-500';
        if (score >= 55) return 'text-sky-500';
        if (score >= 35) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-fuchsia-500';
        if (score >= 55) return 'bg-sky-500';
        if (score >= 35) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getRecBadge = (rec: string) => {
        switch (rec) {
            case 'Super Fun!': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
            case 'Good for Kids': return 'bg-sky-50 text-sky-700 border-sky-200';
            case 'Okay': return 'bg-amber-50 text-amber-700 border-amber-200';
            default: return 'bg-rose-50 text-rose-700 border-rose-200';
        }
    };

    const hasBoringActivities = result
        ? result.scored_activities.some(a => a.overall_score < 40)
        : aiMessages.some(m => m.includes('bore') || m.includes('reconsider'));

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-card p-5 shadow-card"
        >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Baby className="h-4 w-4 text-fuchsia-400" /> Child Mode
                </h3>
                <div className="flex items-center gap-2">
                    <Label htmlFor="child-toggle" className="text-xs text-muted-foreground">
                        {childMode ? 'On' : 'Off'}
                    </Label>
                    <Switch
                        id="child-toggle"
                        checked={childMode}
                        onCheckedChange={toggleChildMode}
                    />
                </div>
            </div>

            {!childMode && (
                <p className="text-center text-xs text-muted-foreground py-3">
                    Enable child mode to get kid-friendly insights and swap boring activities for fun ones 🎠
                </p>
            )}

            {loading && (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-fuchsia-500 mr-2" />
                    <span className="text-sm text-muted-foreground">Finding the fun stuff... 🎪</span>
                </div>
            )}

            {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <AnimatePresence mode="wait">
                {childMode && !loading && (aiMessages.length > 0 || result) && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {/* AI Messages */}
                        {aiMessages.length > 0 && (
                            <div className="rounded-lg bg-fuchsia-500/5 border border-fuchsia-200/30 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="h-4 w-4 text-fuchsia-500" />
                                    <p className="text-xs font-semibold text-foreground">Kid-Friendly Analysis</p>
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

                        {/* Removed items */}
                        {removedItems.length > 0 && (
                            <div className="rounded-lg bg-fuchsia-50 border border-fuchsia-200 p-3">
                                <p className="text-xs font-semibold text-fuchsia-700 mb-1">Removed Boring Activities 👋</p>
                                {removedItems.map((name, i) => (
                                    <p key={i} className="text-[11px] text-fuchsia-600 flex items-center gap-1">
                                        <Trash2 className="h-3 w-3" /> {name}
                                    </p>
                                ))}
                            </div>
                        )}

                        {/* Overall score */}
                        {result && (
                            <div className="flex items-center gap-4 rounded-lg bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 p-4">
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
                                            stroke={result.overall_child_score >= 70 ? '#d946ef' : result.overall_child_score >= 50 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="3"
                                            strokeDasharray={`${result.overall_child_score}, 100`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <span className={`font-display text-base font-bold ${getScoreColor(result.overall_child_score)}`}>
                                        {Math.round(result.overall_child_score)}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-display text-sm font-semibold text-foreground">Fun Score</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {result.overall_child_score >= 70 ? '🎉 Super fun trip for kids!' : result.overall_child_score >= 50 ? '👍 Pretty good, some tweaks needed' : '😴 Needs more fun activities!'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Scored activities */}
                        {result && result.scored_activities.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activity Fun Scores</p>
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
                                                <span className="text-sm">{act.emoji}</span>
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
                                                                <PartyPopper className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                                                                <p className={`font-display text-xs font-bold ${getScoreColor(act.fun_score)}`}>{Math.round(act.fun_score)}</p>
                                                                <p className="text-[9px] text-muted-foreground">Fun</p>
                                                            </div>
                                                            <div>
                                                                <Star className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                                                                <p className={`font-display text-xs font-bold ${getScoreColor(act.safety_score)}`}>{Math.round(act.safety_score)}</p>
                                                                <p className="text-[9px] text-muted-foreground">Safety</p>
                                                            </div>
                                                            <div>
                                                                <Sparkles className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                                                                <p className={`font-display text-xs font-bold ${getScoreColor(act.engagement_score)}`}>{Math.round(act.engagement_score)}</p>
                                                                <p className="text-[9px] text-muted-foreground">Engage</p>
                                                            </div>
                                                        </div>
                                                        {act.reasons.length > 0 && (
                                                            <ul className="space-y-0.5">
                                                                {act.reasons.map((r, j) => (
                                                                    <li key={j} className="text-[10px] text-muted-foreground">{r}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                        {act.suggested_alternative && (
                                                            <p className="text-[10px] font-medium text-fuchsia-600 bg-fuchsia-50 rounded px-2 py-1">
                                                                💡 Try instead: {act.suggested_alternative}
                                                            </p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Make it Fun button */}
                        {hasBoringActivities && removedItems.length === 0 && (
                            <Button
                                onClick={makeFun}
                                className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-600 hover:to-violet-600 text-white"
                                size="sm"
                            >
                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                Make it Fun! — Remove Boring Activities
                            </Button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ChildModePanel;
