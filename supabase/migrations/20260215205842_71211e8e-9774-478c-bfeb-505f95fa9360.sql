
-- bulb_records table
CREATE TABLE public.bulb_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  bulb_type text NOT NULL,
  easter_date date NOT NULL,
  removal_date date NOT NULL,
  dbe numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bulb_records_year ON public.bulb_records (year);
CREATE INDEX idx_bulb_records_bulb_type ON public.bulb_records (bulb_type);

-- weather_daily table
CREATE TABLE public.weather_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date date NOT NULL UNIQUE,
  tavg_f numeric NOT NULL,
  tmin_f numeric,
  tmax_f numeric
);
