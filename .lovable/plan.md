

# Revert Import Filters, Keep Recommendation Engine Clean

## What Changes

The grower wants all their data (including notes like "2025 bonzi tulips..." and "Additional Notes:") imported and visible in the records table. The fix should only prevent those entries from being used in the recommendation calculations.

## Changes

### 1. Revert ExcelUpload.tsx import filter
Remove the two regex filters added in the last edit. Go back to the original validation that only requires `year > 0`, `bulb_type`, `easter_date`, and either `removal_date` or `dbe`.

### 2. Revert fetchBulbTypes in bulb-utils.ts
Remove the `.not("removal_date", "is", null)` filter so all bulb types (including note-like entries) appear in the records table and dropdown.

### 3. Filter only in the recommendation generation flow
In `Index.tsx`, when "All Types" is selected and we loop over `bulbTypes`, filter the list to only include types that have at least one record with a valid `removal_date` or `dbe`. This keeps junk types out of the recommendation engine without hiding them from the grower.

Specifically, before calling `callBulbRecommendations` for each type, query the database for types that have valid data:

```typescript
// In handleGenerate, before the Promise.all:
const { data: validTypes } = await supabase
  .from("bulb_records")
  .select("bulb_type")
  .not("removal_date", "is", null);
const validTypeSet = new Set(validTypes?.map(r => r.bulb_type) || []);
const typesToProcess = bulbTypes.filter(bt => validTypeSet.has(bt));
```

### 4. Edge function already handles this gracefully
The `bulb-recommendations` edge function already filters out records without valid DBE values (step 4 in the code) and falls back when fewer than 2 records exist. No changes needed there.

## Summary of File Changes
- **src/components/ExcelUpload.tsx** -- remove the two regex lines (revert to original filter)
- **src/lib/bulb-utils.ts** -- remove `.not("removal_date", "is", null)` from `fetchBulbTypes`
- **src/pages/Index.tsx** -- add a pre-filter in `handleGenerate` to only send types with valid data to the recommendation engine

