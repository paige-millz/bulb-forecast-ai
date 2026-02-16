

# Finishing Date Adjustment by Bulb Type

## Overview
Add a "finishing date" concept where bulbs must be ready a certain number of days before Easter. Since historical DBE values are measured relative to Easter day, the system shifts recommended removal dates earlier by the finishing offset.

## Logic

| Bulb Type | Finishing Offset | Effect on Removal Date |
|-----------|-----------------|----------------------|
| Contains "1/3" | 10 days before Easter | Shift removal 10 days earlier (DBE + 10) |
| Contains "oval" | 10 days before Easter | Shift removal 10 days earlier (DBE + 10) |
| All others (2/3s, etc.) | 4 days before Easter | Shift removal 4 days earlier (DBE + 4) |

**Formula**: `adjustedRemovalDate = Easter - (DBE + finishingOffset)`
**Finishing Date**: `Easter - finishingOffset`

## Changes

### 1. `src/lib/bulb-utils.ts`
- Add `getDefaultFinishingDaysBefore(bulbType: string): number` helper (returns 10 for 1/3/oval, 4 for others)
- Add `finishingDate` and `finishingDaysBefore` to `EdgeFunctionResponse` interface
- Update `callBulbRecommendations` to pass `finishingDaysBefore` to the edge function

### 2. `supabase/functions/bulb-recommendations/index.ts`
- Accept optional `finishingDaysBefore` parameter (auto-detect from bulb type if not provided)
- Add `getDefaultFinishing(bulbType)` function mirroring frontend logic
- Compute `finishingDate = Easter - finishingDaysBefore`
- Shift all dates earlier by `finishingDaysBefore`:
  - `recommendedRemovalDate = Easter - (roundedMedian + finishingDaysBefore)`
  - Window start/end shifted similarly
  - Weather-adjusted dates shifted similarly
- Include `finishingDate` and `finishingDaysBefore` in response

### 3. `src/components/RecommendationsTable.tsx`
- Add "Finish By" column between "Easter" and "Median DBE"
- Display the finishing date for each bulb type

### 4. `src/components/KPIPanel.tsx`
- Add "Finish By Date" KPI card (displayed when single bulb type selected)

### 5. `src/pages/CalendarView.tsx`
- Mark finishing dates on calendar with a distinct indicator (e.g., diamond or outlined dot) alongside the removal date markers

### 6. `src/pages/Index.tsx`
- No changes needed beyond what flows through the updated response type

## Files Modified
- `src/lib/bulb-utils.ts` -- helper + type updates
- `supabase/functions/bulb-recommendations/index.ts` -- core logic shift
- `src/components/RecommendationsTable.tsx` -- new column
- `src/components/KPIPanel.tsx` -- new card
- `src/pages/CalendarView.tsx` -- finishing date markers

