import { motion } from 'framer-motion';
import { Navigation, AlertTriangle, Route } from 'lucide-react';
import type { TrafficCondition } from '@/data/mockData';

interface TrafficPanelProps {
  traffic: TrafficCondition;
}

const congestionColors: Record<string, string> = {
  low: 'text-success',
  moderate: 'text-warning',
  heavy: 'text-destructive',
  severe: 'text-destructive',
};

const congestionBg: Record<string, string> = {
  low: 'bg-success/15',
  moderate: 'bg-warning/15',
  heavy: 'bg-destructive/15',
  severe: 'bg-destructive/15',
};

const TrafficPanel = ({ traffic }: TrafficPanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-xl bg-card p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Navigation className="h-4 w-4" />
          Traffic
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${congestionBg[traffic.congestionLevel]} ${congestionColors[traffic.congestionLevel]}`}
        >
          {traffic.congestionLevel}
        </span>
      </div>

      <div className="mb-4 flex items-baseline gap-2">
        <p className="font-display text-3xl font-bold text-foreground">+{traffic.overallDelay}</p>
        <p className="text-sm text-muted-foreground">min delay</p>
      </div>

      <div className="space-y-2">
        {traffic.affectedRoutes.map((route, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg bg-secondary/60 p-2.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
            <p className="text-xs text-foreground">{route}</p>
          </div>
        ))}
        {traffic.alternativeAvailable && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-2.5">
            <Route className="h-3.5 w-3.5 shrink-0 text-success" />
            <p className="text-xs font-medium text-success">Alternative route available</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TrafficPanel;
