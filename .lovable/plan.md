
# Adjustable Finishing Days in Configuration

## Overview
Add a "Ship By (days before Easter)" input to the Configuration card so growers can override the default finishing offset before running a recommendation. The default auto-populates based on the selected bulb type (10 for 1/3/oval, 4 for others), and any change from the default shifts the recommendation accordingly.

## How It Works
- When bulb type selection changes, the finishing days input auto-fills with the default for that type (10 or 4)
- The grower can manually adjust the number
- When "All" is selected, the input is hidden (each type uses its own default)
- If the grower changes the value, the delta from the default is applied to shift the recommendation
- The value is passed through `callBulbRecommendations` to the edge function

## UI Changes

### Configuration Card (before the Generate button)
```
Target Easter Year: [2026]    Bulb Type: [2/3 Hyacinth ▼]
Easter: 2026-04-05            Ship By: [4] days before Easter
                              (default: 4 for this type)

[Generate Recommendation]
```

When "All" is selected, the Ship By input is hidden since each type uses its own default.

## Technical Details

### `src/pages/Index.tsx`
- Add state: `finishingDays` (number | null) -- null means "use default"
- When `selectedBulb` changes, auto-set `finishingDays` to the default for that type (or null for "All")
- Show a number input labeled "Ship By (days before Easter)" when a specific bulb type is selected
- Show the default value as helper text below
- Pass `finishingDays` to `callBulbRecommendations`
- When "All" is selected, pass `undefined` so each type uses its own default

### `src/lib/bulb-utils.ts`
- Update `callBulbRecommendations` signature to accept an optional `finishingDaysBefore` parameter
- Pass it in the edge function request body (already supported by the edge function)

### No edge function changes needed
The edge function already accepts `finishingDaysBefore` as an optional parameter and computes the offset from the default.

## Files Modified
- `src/pages/Index.tsx` -- new state + input field + pass to generate
- `src/lib/bulb-utils.ts` -- update `callBulbRecommendations` to accept optional finishing param
