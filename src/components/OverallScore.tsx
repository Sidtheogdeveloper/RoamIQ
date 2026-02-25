import { motion } from 'framer-motion';
import { Activity } from '@/data/mockData';
import { TrendingUp, Zap } from 'lucide-react';

interface OverallScoreProps {
  activities: Activity[];
}

const OverallScore = ({ activities }: OverallScoreProps) => {
  const avgScore = Math.round(activities.reduce((sum, a) => sum + a.score, 0) / activities.length);
  const totalDelay = activities.reduce((sum, a) => sum + a.trafficDelay, 0);
  const weatherRisks = activities.filter((a) => a.weatherImpact === 'high').length;
  const crowdedCount = activities.filter((a) => a.crowdLevel === 'high').length;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (avgScore / 100) * circumference;
  const scoreColor =
    avgScore >= 80 ? 'stroke-success' : avgScore >= 60 ? 'stroke-warning' : 'stroke-destructive';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated"
    >
      <div className="flex items-center gap-6">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="absolute -rotate-90" width={96} height={96}>
            <circle cx={48} cy={48} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={5} />
            <motion.circle
              cx={48}
              cy={48}
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <span className="font-display text-2xl font-bold">{avgScore}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">Itinerary Health</h2>
          <p className="mt-0.5 text-sm text-primary-foreground/70">
            Barcelona · Today
          </p>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="font-display text-lg font-bold">{totalDelay}</p>
              <p className="text-[11px] text-primary-foreground/60">min delay</p>
            </div>
            <div className="text-center">
              <p className="font-display text-lg font-bold">{weatherRisks}</p>
              <p className="text-[11px] text-primary-foreground/60">weather risks</p>
            </div>
            <div className="text-center">
              <p className="font-display text-lg font-bold">{crowdedCount}</p>
              <p className="text-[11px] text-primary-foreground/60">crowded spots</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-foreground/15 px-4 py-2.5 text-sm font-semibold text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/25">
          <Zap className="h-4 w-4" />
          Optimize Now
        </button>
        <button className="flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-4 py-2.5 text-sm font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/20">
          <TrendingUp className="h-4 w-4" />
          Details
        </button>
      </div>
    </motion.div>
  );
};

export default OverallScore;
