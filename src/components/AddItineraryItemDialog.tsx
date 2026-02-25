import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plane, Hotel, Camera, Utensils, Bus, Coffee, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  dayNumber: number;
  onCreated: () => void;
}

const itemTypes = [
  { value: 'departure', label: 'Departure', icon: Plane },
  { value: 'arrival', label: 'Arrival', icon: Plane },
  { value: 'hotel_checkin', label: 'Hotel Check-in', icon: Hotel },
  { value: 'hotel_checkout', label: 'Hotel Check-out', icon: Hotel },
  { value: 'activity', label: 'Activity', icon: Camera },
  { value: 'meal', label: 'Meal', icon: Utensils },
  { value: 'transport', label: 'Transport', icon: Bus },
  { value: 'free_time', label: 'Free Time', icon: Coffee },
];

const AddItineraryItemDialog = ({ open, onOpenChange, tripId, dayNumber, onCreated }: Props) => {
  const [itemType, setItemType] = useState('activity');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [isOutdoor, setIsOutdoor] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('itinerary_items').insert({
      trip_id: tripId,
      user_id: user.id,
      day_number: dayNumber,
      item_type: itemType,
      title,
      description: description || null,
      location: location || null,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: parseInt(duration) || 60,
      is_outdoor: isOutdoor,
      sort_order: Date.now() % 2147483647,
    });

    if (error) {
      toast({ title: 'Failed to add item', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Activity added!' });
      onCreated();
      onOpenChange(false);
      resetForm();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setItemType('activity');
    setTitle('');
    setDescription('');
    setLocation('');
    setStartTime('');
    setEndTime('');
    setDuration('60');
    setIsOutdoor(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add to Day {dayNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-title">Title</Label>
            <Input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Visit the Eiffel Tower" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-location">Location</Label>
            <Input id="item-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Paris, France" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start</Label>
              <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End</Label>
              <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (min)</Label>
              <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-desc">Notes (optional)</Label>
            <Textarea id="item-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any special notes…" rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
            <Label htmlFor="outdoor" className="text-sm">Outdoor activity</Label>
            <Switch id="outdoor" checked={isOutdoor} onCheckedChange={setIsOutdoor} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding…' : 'Add to Itinerary'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddItineraryItemDialog;
