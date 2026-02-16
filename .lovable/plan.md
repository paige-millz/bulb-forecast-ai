
# Suppress Per-Type Weather Warnings in "All Types" Mode

## Problem
When running "All Types", each bulb type is processed by the edge function individually. Types that only appear in 1-2 years generate weather pairing warnings like "Only 1 year(s) have paired weather+DBE data." These per-type warnings are then merged and displayed as top-level alerts, which is confusing in aggregate mode.

## Solution
Filter out weather-related informational notes when displaying results from an "All Types" run. The weather context still exists in the data for the AI assistant and explanation card -- we just stop surfacing per-type weather warnings as top-level alerts in aggregate mode.

## Changes

### `src/pages/Index.tsx`
In the notes display section (around line 150), when `selectedBulb === "All"` and there are multiple results, filter out weather-related notes before rendering. Specifically, skip notes that match patterns like:
- "Only X year(s) have paired weather+DBE data"
- "No weather data for YYYY yet"
- "Weather correlation too weak"
- "Weather data exists but doesn't overlap"
- "No weather data synced yet"
- "Could not load weather data"

These are per-type implementation details that aren't useful in the aggregate summary. Keep non-weather notes (like "Limited historical data" or "High variability") since those are directly actionable.

Single bulb type runs will continue to show all notes as before.

### Technical Detail
One filter applied to the deduplicated notes array:
```typescript
const allNotes = [...new Set(results.flatMap(r => r.notes || []))];
const displayNotes = results.length > 1
  ? allNotes.filter(n => !n.match(/paired weather|No weather data|Weather correlation|Weather data exists|Could not load weather/i))
  : allNotes;
```
