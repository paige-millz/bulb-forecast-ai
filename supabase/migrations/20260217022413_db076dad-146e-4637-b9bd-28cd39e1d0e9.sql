
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update bulb_records RLS: replace permissive "true" with auth-scoped
DROP POLICY IF EXISTS "Allow all on bulb_records" ON public.bulb_records;
CREATE POLICY "Authenticated users can read bulb_records"
  ON public.bulb_records FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert bulb_records"
  ON public.bulb_records FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update bulb_records"
  ON public.bulb_records FOR UPDATE
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can delete bulb_records"
  ON public.bulb_records FOR DELETE
  TO authenticated
  USING (true);

-- Update weather_daily RLS
DROP POLICY IF EXISTS "Allow all on weather_daily" ON public.weather_daily;
CREATE POLICY "Authenticated users can read weather_daily"
  ON public.weather_daily FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert weather_daily"
  ON public.weather_daily FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update weather_daily"
  ON public.weather_daily FOR UPDATE
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can delete weather_daily"
  ON public.weather_daily FOR DELETE
  TO authenticated
  USING (true);
