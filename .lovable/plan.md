

# Easter Week Summary Card and CSV Export

## Overview

Add a summary comparison card showing the predicted Easter week average temperature versus historical Easter week averages, and add a CSV export button for weather data.

## Changes

### `src/pages/Weather.tsx`

**1. Easter Week Summary Card** (placed between the forecast chart and historical chart)

- Compute the "Easter week" as Easter Sunday +/- 3 days (7-day window)
- **Forecast Easter week avg**: Average the forecast `tavg` values for dates falling within the Easter week window. Show "N/A" if Easter is outside the forecast range.
- **Historical Easter week avgs**: For each year in the historical data, compute Easter date via `computeEasterDate(year)`, find the 7-day window around it, average `tavg_f` for those dates. Display as a small table or list showing each year's Easter week avg.
- **Overall historical mean**: Average of all years' Easter week averages, displayed prominently for quick comparison.
- Visual indicators: color the forecast value green/red/neutral depending on whether it's warmer or cooler than the historical mean.

Card layout:
```text
+--------------------------------------------------+
| Easter Week Temperature Comparison               |
|                                                  |
|  Forecast (2026):  48.2 F   [arrow up, green]    |
|  Historical Avg:   44.7 F   (across 12 years)    |
|                                                  |
|  Year   Easter Date   Avg Temp                   |
|  2024   Mar 31        46.1 F                     |
|  2023   Apr 9         42.3 F                     |
|  ...                                             |
+--------------------------------------------------+
```

**2. CSV Export Button**

- Add a "Download CSV" button to each card's header area (using the `Download` icon from lucide-react)
- **Forecast CSV**: Exports the 16-day forecast data (date, avg, min, max)
- **Historical CSV**: Exports the full historical weather data from the database (date, tavg_f, tmin_f, tmax_f)
- Reuse the existing `downloadFile` utility from `bulb-utils.ts`

## Technical Details

### Easter Week Computation (new `useMemo` block)

```typescript
// For each historical year, compute Easter, find weather records within +/- 3 days
// For forecast, filter forecastData to the same Easter week window
// Return: { forecastAvg, historicalByYear: [{year, easterDate, avg}], overallHistoricalAvg }
```

### CSV Export Functions

Two simple functions that convert the chart data arrays to CSV strings and trigger download via the existing `downloadFile` helper.

### New Imports

- `Download`, `TrendingUp`, `TrendingDown` from `lucide-react`
- `downloadFile` from `@/lib/bulb-utils`
- `CardDescription` from card component

