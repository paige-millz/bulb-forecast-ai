
-- Fix overly permissive RLS policies on bulb_records
-- Replace bare `true` with auth.uid() IS NOT NULL

DROP POLICY IF EXISTS "Authenticated users can delete bulb_records" ON public.bulb_records;
DROP POLICY IF EXISTS "Authenticated users can insert bulb_records" ON public.bulb_records;
DROP POLICY IF EXISTS "Authenticated users can read bulb_records" ON public.bulb_records;
DROP POLICY IF EXISTS "Authenticated users can update bulb_records" ON public.bulb_records;

CREATE POLICY "Authenticated users can read bulb_records"
  ON public.bulb_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bulb_records"
  ON public.bulb_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bulb_records"
  ON public.bulb_records FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bulb_records"
  ON public.bulb_records FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Fix overly permissive RLS policies on weather_daily

DROP POLICY IF EXISTS "Authenticated users can delete weather_daily" ON public.weather_daily;
DROP POLICY IF EXISTS "Authenticated users can insert weather_daily" ON public.weather_daily;
DROP POLICY IF EXISTS "Authenticated users can read weather_daily" ON public.weather_daily;
DROP POLICY IF EXISTS "Authenticated users can update weather_daily" ON public.weather_daily;

CREATE POLICY "Authenticated users can read weather_daily"
  ON public.weather_daily FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert weather_daily"
  ON public.weather_daily FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update weather_daily"
  ON public.weather_daily FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete weather_daily"
  ON public.weather_daily FOR DELETE
  USING (auth.uid() IS NOT NULL);
