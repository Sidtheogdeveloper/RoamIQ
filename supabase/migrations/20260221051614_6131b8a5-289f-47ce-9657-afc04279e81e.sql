
-- Create itinerary items table for day-wise planning
CREATE TABLE public.itinerary_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  day_number INTEGER NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'activity',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  category TEXT DEFAULT 'general',
  is_outdoor BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint for item_type
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_type_check
  CHECK (item_type IN ('departure', 'arrival', 'hotel_checkin', 'hotel_checkout', 'activity', 'meal', 'transport', 'free_time'));

-- Enable RLS
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own itinerary items"
  ON public.itinerary_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own itinerary items"
  ON public.itinerary_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itinerary items"
  ON public.itinerary_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itinerary items"
  ON public.itinerary_items FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER update_itinerary_items_updated_at
  BEFORE UPDATE ON public.itinerary_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add source_city column to trips for "starting from" info
ALTER TABLE public.trips ADD COLUMN source_city TEXT;
ALTER TABLE public.trips ADD COLUMN hotel_name TEXT;
