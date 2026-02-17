# Remove Finishing Offset from Removal Date Calculations

## What Changes

The finishing date is informational only -- it tells the grower when bulbs must be ready. The actual removal date recommendation stays based purely on historical DBE relative to Easter, with no shifting.

But moving forward... if the finish by date changes from the default 10 days and 4 days based on bulb type then the recommendation should shift accordingly. 

## Technical Details

### `supabase/functions/bulb-recommendations/index.ts`

Remove `+ finishingDaysBefore` from all date calculations:

- Line 199: `recommendedDate = addDays(easter, -roundedMedian)` (remove `+ finishingDaysBefore`)
- Line 200: `windowStart = addDays(easter, -Math.round(p75DBE))` (remove `+ finishingDaysBefore`)
- Line 201: `windowEnd = addDays(easter, -Math.round(p25DBE))` (remove `+ finishingDaysBefore`)
- Line 402: GDH weather-adjusted date: `addDays(easter, -projectedDBE)` (remove `+ finishingDaysBefore`)
- Lines 405-406: GDH weather-adjusted window: remove `+ finishingDaysBefore`
- Line 463: Regression weather-adjusted date: remove `+ finishingDaysBefore`
- Lines 465-467: Regression weather-adjusted window: remove `+ finishingDaysBefore`

The `finishingDate` and `finishingDaysBefore` fields remain in the response as informational context. The grower can still adjust the finishing days parameter -- it just affects the displayed finishing date, not the removal recommendation.

### No other file changes needed

The UI components (RecommendationsTable, KPIPanel, CalendarView) already display finishing date separately from removal date, so they work correctly as-is.

## Files Modified

- `supabase/functions/bulb-recommendations/index.ts` -- remove finishing offset from all removal date math