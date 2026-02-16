
-- Add new columns to bulb_records
ALTER TABLE public.bulb_records
  ADD COLUMN IF NOT EXISTS ship_date date,
  ADD COLUMN IF NOT EXISTS avg_temp_from_removal_f numeric,
  ADD COLUMN IF NOT EXISTS degree_hours_above_40f numeric,
  ADD COLUMN IF NOT EXISTS yield_notes text,
  ADD COLUMN IF NOT EXISTS yield_quality text,
  ADD COLUMN IF NOT EXISTS grower_notes text;

-- Make removal_date and dbe nullable (CSV has rows without them)
ALTER TABLE public.bulb_records
  ALTER COLUMN removal_date DROP NOT NULL,
  ALTER COLUMN dbe DROP NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_bulb_records_year ON public.bulb_records(year);
CREATE INDEX IF NOT EXISTS idx_bulb_records_bulb_type ON public.bulb_records(bulb_type);

-- Add source column to weather_daily
ALTER TABLE public.weather_daily
  ADD COLUMN IF NOT EXISTS source text;
