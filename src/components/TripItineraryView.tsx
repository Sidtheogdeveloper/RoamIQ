import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MapPin, Calendar, Clock, Trash2, Pencil,
  Plane, Hotel, Camera, Utensils, Bus, Coffee, DollarSign, Check,
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';

type ItineraryItem = Tables<'itinerary_items'>;

const itemTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  departure: { icon: Plane, color: 'text-primary', bg: 'bg-primary/10' },
  arrival: { icon: Plane, color: 'text-success', bg: 'bg-success/10' },
  hotel_checkin: { icon: Hotel, color: 'text-accent', bg: 'bg-accent/10' },
  hotel_checkout: { icon: Hotel, color: 'text-warning', bg: 'bg-warning/10' },
  activity: { icon: Camera, color: 'text-info', bg: 'bg-info/10' },
  meal: { icon: Utensils, color: 'text-accent', bg: 'bg-accent/10' },
  transport: { icon: Bus, color: 'text-muted-foreground', bg: 'bg-secondary' },
  free_time: { icon: Coffee, color: 'text-success', bg: 'bg-success/10' },
};

interface Props {
  items: ItineraryItem[];
  selectedDay: number;
  startDate: string;
  onDeleteItem: (id: string) => void;
  onEditItem: (item: ItineraryItem) => void;
  onAddItem: () => void;
  onToggleComplete?: (id: string, isCompleted: boolean, actualCost: number | null) => void;
}

const SpendingPopover = ({ item, onConfirm }: { item: ItineraryItem; onConfirm: (cost: number | null) => void }) => {
  const [cost, setCost] = useState(item.actual_cost?.toString() || '');
  const [open, setOpen] = useState(true);

  const handleSubmit = () => {
    const parsed = cost ? parseFloat(cost) : null;
    onConfirm(parsed);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) { onConfirm(null); } setOpen(o); }}>
      <PopoverTrigger asChild>
        <button className="hidden" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" side="right" align="start">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-foreground">How much did you spend?</p>
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="number"
              placeholder="0.00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              min="0"
              step="0.01"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleSubmit}>
            <Check className="mr-1 h-3 w-3" /> Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const TripItineraryView = ({ items, selectedDay, startDate, onDeleteItem, onEditItem, onAddItem, onToggleComplete }: Props) => {
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);

  const dayItems = items
    .filter((i) => i.day_number === selectedDay)
    .sort((a, b) => a.sort_order - b.sort_order);

  const handleCheckboxChange = (item: ItineraryItem, checked: boolean) => {
    if (!onToggleComplete) return;
    if (checked) {
      // Show spending popover
      setPendingCompleteId(item.id);
    } else {
      // Uncheck — clear cost
      onToggleComplete(item.id, false, null);
    }
  };

  const handleSpendingConfirm = (itemId: string, cost: number | null) => {
    if (onToggleComplete) {
      onToggleComplete(itemId, true, cost);
    }
    setPendingCompleteId(null);
  };

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {dayItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12"
          >
            <div className="rounded-full bg-secondary p-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No activities planned for Day {selectedDay}</p>
            <Button variant="outline" size="sm" onClick={onAddItem}>
              <Plus className="mr-1 h-4 w-4" /> Add Activity
            </Button>
          </motion.div>
        ) : (
          dayItems.map((item, i) => {
            const cfg = itemTypeConfig[item.item_type] || itemTypeConfig.activity;
            const Icon = cfg.icon;
            const isCompleted = item.is_completed;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={`group relative flex gap-3 rounded-xl bg-card p-4 shadow-card transition-all hover:shadow-elevated ${isCompleted ? 'opacity-60' : ''}`}
              >
                {/* Checkbox */}
                {onToggleComplete && (
                  <div className="flex items-start pt-0.5">
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={(checked) => handleCheckboxChange(item, !!checked)}
                      className="h-5 w-5"
                    />
                    {pendingCompleteId === item.id && (
                      <SpendingPopover
                        item={item}
                        onConfirm={(cost) => handleSpendingConfirm(item.id, cost)}
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  {i < dayItems.length - 1 && <div className="mt-1.5 h-full w-px bg-border" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={`font-display text-sm font-semibold text-foreground ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{item.title}</h4>
                      {item.description && <p className={`mt-0.5 text-xs text-muted-foreground ${isCompleted ? 'line-through' : ''}`}>{item.description}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => onEditItem(item)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.start_time}{item.end_time ? ` – ${item.end_time}` : ''}
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{item.location}
                      </span>
                    )}
                    {item.duration_minutes && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{item.duration_minutes} min</span>
                    )}
                    {item.is_outdoor && (
                      <span className="rounded bg-info/10 px-1.5 py-0.5 text-[11px] text-info">Outdoor</span>
                    )}
                    {isCompleted && item.actual_cost != null && (
                      <span className="flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">
                        <DollarSign className="h-2.5 w-2.5" />Spent: {item.actual_cost.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>

      {dayItems.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={onAddItem}>
          <Plus className="mr-1 h-4 w-4" /> Add to Day {selectedDay}
        </Button>
      )}
    </div>
  );
};

export default TripItineraryView;
