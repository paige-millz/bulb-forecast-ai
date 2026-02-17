

# Adjustable Finish By Date — Per Bulb Type and Calendar Picker

## Overview

When running for **All** bulb types, the recommendation summary table already shows each type's assumed "Finish By" date. No input control is needed since each type uses its own default.

When a **specific bulb type** is selected, the Configuration card will let the grower adjust the finishing target in two ways:
1. Change the number of days before Easter (existing input, enhanced)
2. Pick a specific date on a calendar — the system back-calculates the days-before-Easter value

Both inputs stay synced: changing the number updates the calendar, and picking a date updates the number.

## UI Design

```text
Bulb Type: [2/3 Hyacinth]

Ship By Target
┌──────────────────────────────────────────────┐
│  [4] days before Easter    — or —   [📅 2026-03-31]  │
│  Default: 4 for this type                            │
└──────────────────────────────────────────────┘
```

When "All" is selected, these controls are hidden — each type uses its own default, and the Finish By column in the results table shows the assumed date per type (already working).

## Technical Details

### `src/pages/Index.tsx`

1. Import `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent` from existing UI components, plus `format` from `date-fns` and `CalendarIcon` from `lucide-react`.

2. Add a computed `finishingDate` derived from `easter` minus `finishingDays`:
   ```
   const finishingDate = new Date(easter)
   finishingDate.setDate(finishingDate.getDate() - finishingDays)
   ```

3. Replace the current single number input with a row containing:
   - The number input (days before Easter) — already exists
   - A date picker (Popover + Calendar) showing the computed finishing date
   - When the user picks a date, calculate `diffDays(easter, selectedDate)` and set `finishingDays` to that value

4. Both controls stay in sync via the shared `finishingDays` state.

### No changes needed to:
- `src/lib/bulb-utils.ts` — already accepts the override parameter
- `supabase/functions/bulb-recommendations/index.ts` — already handles the finishing offset
- `src/components/RecommendationsTable.tsx` — already displays `finishingDate` from the response

## Files Modified
- `src/pages/Index.tsx` — add date picker alongside the days input, keep them synced
