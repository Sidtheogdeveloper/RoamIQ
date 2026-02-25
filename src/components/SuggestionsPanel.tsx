import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  ArrowRightLeft,
  Clock,
  Route,
  Sparkles,
  Check,
  X,
  ChevronRight,
} from 'lucide-react';
import type { Suggestion } from '@/data/mockData';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
}

const typeIcons: Record<string, React.ElementType> = {
  swap: ArrowRightLeft,
  alternative: Sparkles,
  timing: Clock,
  route: Route,
};

const priorityStyles: Record<string, string> = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-success',
};

const SuggestionsPanel = ({ suggestions }: SuggestionsPanelProps) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl bg-card p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="h-4 w-4 text-accent" />
          Smart Suggestions
        </h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {visible.length} active
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visible.map((suggestion) => {
            const Icon = typeIcons[suggestion.type] || Lightbulb;
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
                <div className="p-3.5">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="mt-0.5 rounded-md bg-card p-1.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground">{suggestion.title}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.description}</p>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-1.5 text-[11px]">
                    <span className="rounded bg-card px-1.5 py-0.5 font-medium text-muted-foreground">
                      {suggestion.reason}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <ChevronRight className="h-3 w-3" />
                      {suggestion.impact}
                    </span>

                    {!isAccepted ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setDismissed((s) => new Set([...s, suggestion.id]))}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setAccepted((s) => new Set([...s, suggestion.id]))}
                          className="rounded-md bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <Check className="h-3 w-3" />
                        Applied
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SuggestionsPanel;
