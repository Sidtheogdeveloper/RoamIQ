import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Hotel, Sparkles, Loader2, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CURRENCIES = [
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'INR', label: '₹ INR' },
  { value: 'JPY', label: '¥ JPY' },
  { value: 'AUD', label: 'A$ AUD' },
  { value: 'CAD', label: 'C$ CAD' },
];

const CreateTripDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [sourceCity, setSourceCity] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
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

    const { data: tripData, error } = await supabase.from('trips').insert({
      name,
      destination,
      source_city: sourceCity || null,
      hotel_name: hotelName || null,
      start_date: startDate,
      end_date: endDate,
      description: description || null,
      budget: budget ? parseFloat(budget) : null,
      currency,
      user_id: user.id,
      status: 'planning',
    }).select().single();

    if (error) {
      toast({ title: 'Failed to create trip', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    toast({ title: 'Trip created! Generating itinerary with AI…', description: 'This may take a moment.' });
    onCreated();
    onOpenChange(false);

    // Generate AI itinerary in background
    setGenerating(true);
    try {
      const { data: genData, error: genError } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          tripId: tripData.id,
          destination,
          sourceCity: sourceCity || null,
          hotelName: hotelName || null,
          startDate,
          endDate,
          description: description || null,
          budget: budget ? parseFloat(budget) : null,
          currency,
        },
      });
      if (genError) throw genError;
      if (genData?.error === 'BUDGET_TOO_LOW') {
        toast({
          title: '💸 Budget too low',
          description: genData.message || 'Your budget is insufficient for this trip.',
          variant: 'destructive',
        });
      } else if (genData?.error) {
        throw new Error(genData.error);
      } else {
        const costInfo = genData?.total_estimated_cost
          ? ` (est. ${genData.currency} ${genData.total_estimated_cost.toLocaleString()})`
          : '';
        toast({ title: `✨ AI generated ${genData.count} itinerary items!${costInfo}` });
      }
      onCreated(); // refresh again to show new items
    } catch (err: any) {
      console.error('AI itinerary generation failed:', err);
      toast({ title: 'AI generation failed', description: err.message || 'You can add items manually.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }

    setName(''); setDestination(''); setSourceCity(''); setHotelName('');
    setStartDate(''); setEndDate(''); setDescription(''); setBudget(''); setCurrency('USD');
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Create New Trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Trip Name</Label>
            <Input id="trip-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Getaway" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="source" className="flex items-center gap-1.5">
                <Navigation className="h-3 w-3 text-muted-foreground" /> From
              </Label>
              <Input id="source" value={sourceCity} onChange={(e) => setSourceCity(e.target.value)} placeholder="New York" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination" className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-primary" /> Destination
              </Label>
              <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Barcelona" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hotel" className="flex items-center gap-1.5">
              <Hotel className="h-3 w-3 text-accent" /> Hotel (optional)
            </Label>
            <Input id="hotel" value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="Grand Hotel Barcelona" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget" className="flex items-center gap-1.5">
              <DollarSign className="h-3 w-3 text-primary" /> Budget
            </Label>
            <div className="flex gap-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="budget"
                type="number"
                min="0"
                step="50"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 2000"
                className="flex-1"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">AI will plan within your budget and suggest cost optimizations</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this trip about?" rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create Trip'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTripDialog;
