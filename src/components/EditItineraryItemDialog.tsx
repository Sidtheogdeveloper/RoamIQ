import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plane, Hotel, Camera, Utensils, Bus, Coffee } from 'lucide-react';

type ItineraryItem = Tables<'itinerary_items'>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItineraryItem | null;
  onUpdated: () => void;
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

const EditItineraryItemDialog = ({ open, onOpenChange, item, onUpdated }: Props) => {
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

  useEffect(() => {
    if (item) {
      setItemType(item.item_type);
      setTitle(item.title);
      setDescription(item.description || '');
      setLocation(item.location || '');
      setStartTime(item.start_time || '');
      setEndTime(item.end_time || '');
      setDuration(String(item.duration_minutes || 60));
      setIsOutdoor(item.is_outdoor || false);
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setLoading(true);

    const { error } = await supabase.from('itinerary_items').update({
      item_type: itemType,
      title,
      description: description || null,
      location: location || null,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: parseInt(duration) || 60,
      is_outdoor: isOutdoor,
    }).eq('id', item.id);

    if (error) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Activity updated!' });
      onUpdated();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start</Label>
              <Input id="edit-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">End</Label>
              <Input id="edit-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dur">Duration</Label>
              <Input id="edit-dur" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-desc">Notes</Label>
            <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
            <Label htmlFor="edit-outdoor" className="text-sm">Outdoor activity</Label>
            <Switch id="edit-outdoor" checked={isOutdoor} onCheckedChange={setIsOutdoor} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditItineraryItemDialog;
