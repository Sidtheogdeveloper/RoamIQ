import { motion } from 'framer-motion';
import {
  Clock,
  MapPin,
  Users,
  CloudRain,
  Car,
  Lock,
  Utensils,
  Landmark,
  TreePine,
  ShoppingBag,
  Waves,
  Ticket,
} from 'lucide-react';
import type { Activity } from '@/data/mockData';

interface ActivityCardProps {
  activity: Activity;
  index: number;
  isOptimized?: boolean;
}

const categoryIcons: Record<string, React.ElementType> = {
  cultural: Landmark,
  food: Utensils,
  adventure: Waves,
  nature: TreePine,
  shopping: ShoppingBag,
  entertainment: Ticket,
};

const categoryColors: Record<string, string> = {
  cultural: 'bg-info/15 text-info',
  food: 'bg-accent/15 text-accent',
  adventure: 'bg-primary/15 text-primary',
  nature: 'bg-success/15 text-success',
  shopping: 'bg-warning/15 text-warning',
  entertainment: 'bg-destructive/15 text-destructive',
};

const crowdIndicator: Record<string, { color: string; label: string }> = {
  low: { color: 'text-success', label: 'Low crowds' },
  medium: { color: 'text-warning', label: 'Moderate crowds' },
  high: { color: 'text-destructive', label: 'Very crowded' },
};

const ScoreRing = ({ score }: { score: number }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? 'stroke-success' : score >= 60 ? 'stroke-warning' : 'stroke-destructive';

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="absolute -rotate-90" width={44} height={44}>
        <circle cx={22} cy={22} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={3} />
        <motion.circle
          cx={22}
          cy={22}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.3 }}
        />
      </svg>
      <span className="font-display text-xs font-bold text-foreground">{score}</span>
    </div>
  );
};

const ActivityCard = ({ activity, index, isOptimized }: ActivityCardProps) => {
  const CategoryIcon = categoryIcons[activity.category] || Landmark;
  const crowd = crowdIndicator[activity.crowdLevel];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`group relative flex gap-4 rounded-xl bg-card p-4 shadow-card transition-shadow hover:shadow-elevated ${
        activity.score < 50 ? 'ring-1 ring-destructive/20' : ''
      }`}
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryColors[activity.category]}`}>
          <CategoryIcon className="h-5 w-5" />
        </div>
        {index < 5 && <div className="mt-2 h-full w-px bg-border" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-display text-base font-semibold text-foreground">
                {activity.name}
              </h4>
              {activity.isBooked && (
                <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{activity.description}</p>
          </div>
          <ScoreRing score={activity.score} />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {activity.scheduledTime} · {activity.duration} min
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {activity.location}
          </span>
        </div>

        {/* Impact indicators */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {activity.weatherImpact !== 'none' && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                activity.weatherImpact === 'high'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning'
              }`}
            >
              <CloudRain className="h-3 w-3" />
              {activity.weatherImpact === 'high' ? 'Rain risk' : 'Weather aware'}
            </span>
          )}
          {activity.trafficDelay > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              <Car className="h-3 w-3" />
              +{activity.trafficDelay} min
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              activity.crowdLevel === 'high'
                ? 'bg-destructive/10 text-destructive'
                : activity.crowdLevel === 'medium'
                ? 'bg-warning/10 text-warning'
                : 'bg-success/10 text-success'
            }`}
          >
            <Users className="h-3 w-3" />
            {crowd.label}
          </span>
        </div>
      </div>

      {/* Optimized badge */}
      {isOptimized && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-1 -top-1 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
        >
          Optimized
        </motion.div>
      )}
    </motion.div>
  );
};

export default ActivityCard;
