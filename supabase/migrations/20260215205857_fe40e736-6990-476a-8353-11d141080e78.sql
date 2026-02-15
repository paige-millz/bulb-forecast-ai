
ALTER TABLE public.bulb_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on bulb_records" ON public.bulb_records FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.weather_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on weather_daily" ON public.weather_daily FOR ALL USING (true) WITH CHECK (true);
