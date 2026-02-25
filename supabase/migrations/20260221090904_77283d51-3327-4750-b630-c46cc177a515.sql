
ALTER TABLE public.trips ADD COLUMN budget numeric NULL;
ALTER TABLE public.trips ADD COLUMN currency text NOT NULL DEFAULT 'USD';
