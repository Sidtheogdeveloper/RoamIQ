
-- Add completion tracking fields to itinerary_items
ALTER TABLE public.itinerary_items 
ADD COLUMN is_completed boolean NOT NULL DEFAULT false,
ADD COLUMN actual_cost numeric DEFAULT NULL;
