

# Weather History and Forecast Page

## Overview

Create a new "/weather" page that displays historical weather data from the database in an interactive chart, alongside a forecast for the upcoming Easter season using the Open-Meteo forecast API. This gives a clear visual of past temperature trends and what to expect leading up to the next Easter.

## What You'll See

1. **Historical Weather Chart** -- A line chart showing daily average temperatures (with min/max range) for each year's Feb-Apr season, pulled from the `weather_daily` table.

2. **Upcoming Easter Forecast** -- A separate chart/section showing the weather forecast for the next 7-16 days from Open-Meteo's free forecast API, overlaid with the upcoming Easter date marker so you can see predicted conditions around removal time.

3. **Year-over-Year Comparison** -- A view comparing Feb-Apr temperature patterns across years so you can see how this season stacks up against prior ones.

4. **Navigation** -- A simple nav bar or tabs added to the header so you can move between the main Planner page and the Weather page.

---

## Technical Details

### New Files

**`src/pages/Weather.tsx`**
- Page component with two main sections:
  - "Historical Temperatures" -- queries `weather_daily` for all stored records, groups by year, renders a multi-line Recharts `LineChart` (one line per year for Feb 1 - Apr 30)
  - "Easter Season Forecast" -- calls the `sync-weather` edge function (or a new forecast mode) to get the Open-Meteo 16-day forecast, displays as a line chart with the upcoming Easter date marked via a `ReferenceLine`
- Uses existing Recharts library and Card/chart UI components

**`supabase/functions/sync-weather/index.ts`** (updated)
- Add a **Mode 3: Forecast** -- when body contains `{ forecast: true, latitude, longitude }`, call the Open-Meteo forecast API (`https://api.open-meteo.com/v1/forecast?...&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&forecast_days=16`) and return the data directly (no DB upsert needed)

### Modified Files

**`src/App.tsx`**
- Add route: `<Route path="/weather" element={<Weather />} />`

**`src/pages/Index.tsx`**
- Add a navigation link to "/weather" in the header area

### Data Flow

1. Historical data: `weather_daily` table -> Supabase query -> grouped by year -> multi-line chart
2. Forecast data: Edge function -> Open-Meteo forecast API -> returned to client -> rendered as chart
3. Easter date calculated client-side using existing `computeEasterDate()` utility

### Chart Design

- **Historical chart**: X-axis = day of season (Feb 1 = day 1 through Apr 30), Y-axis = temperature (F). One colored line per year. Tooltip shows date and temps.
- **Forecast chart**: X-axis = date, Y-axis = temperature (F). Shows Tavg line with Tmin/Tmax as a shaded area. Easter date shown as a vertical reference line.

