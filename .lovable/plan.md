
# Plan: Improve Confidence, Add Record Management, and Integrate Weather Data

## Problem Summary

1. **Low confidence scores** -- Each bulb type has only 3 historical records. The engine requires 10+ for "High" and 6+ for "Medium". Additionally, junk rows like "Additional Notes:" pollute the dataset.
2. **No record management** -- Users can only edit yield/grower notes inline. No ability to add, delete, or fully edit records.
3. **Weather data unused** -- The `weather_daily` table is empty and the recommendation engine ignores it entirely.

---

## Changes

### 1. Relax Confidence Thresholds

Update the `bulb-recommendations` edge function to use more realistic thresholds given the small dataset:

- **High**: >= 3 records AND IQR <= 5
- **Medium**: >= 2 records AND IQR <= 8
- **Low**: everything else

This reflects the reality that most growers will have 3-5 years of data per bulb type.

### 2. Filter Junk Records on Import

Update the CSV import logic (`ExcelUpload`) to skip rows where `removal_date` is empty AND `dbe` is empty -- these are notes rows, not real data. Also add a cleanup step in the edge function to exclude records with no usable DBE.

### 3. Add Full Record Management (CRUD)

Add a management panel to the `BulbRecordsTable` component:

- **Delete**: Add a delete button per row to remove individual records
- **Add**: Add an "Add Record" button that opens a dialog/form with fields for year, bulb_type, easter_date, removal_date, dbe, and notes
- **Edit**: Expand inline editing to cover all key fields (year, bulb_type, removal_date, dbe), not just notes

### 4. Integrate Weather Data into Recommendations

Update the `bulb-recommendations` edge function to:

- Query `weather_daily` for temperature data between the recommended removal date and Easter
- Calculate cumulative degree hours above 40F from weather history for similar date ranges in past years
- Add weather context to the response (average temperature forecast, degree-hour accumulation)
- Include a weather-adjusted note if current-year temperatures are significantly warmer/cooler than historical averages, suggesting earlier or later removal

This will NOT change the core statistical approach (median DBE) but will add weather-informed context and warnings.

---

## Technical Details

### Edge Function Changes (`supabase/functions/bulb-recommendations/index.ts`)

- Lower confidence thresholds (lines 124-131)
- After computing the recommended date, query `weather_daily` for historical temperature patterns
- Compare avg temps in the removal-to-Easter window across past years
- Add fields to response: `weatherContext` with avg temp, degree hours, and any adjustment notes

### Frontend: Record Management (`src/components/BulbRecordsTable.tsx`)

- Add delete button per row calling `supabase.from("bulb_records").delete().eq("id", ...)`
- Add "Add Record" button opening a Dialog with a form for all fields
- Expand editable fields beyond just yield_notes and grower_notes
- Add confirmation dialog for deletes

### Frontend: Display Weather Context (`src/components/KPIPanel.tsx`)

- Show weather-related KPIs when weather data is available (avg temp, degree hours)
- Show a note if no weather data has been synced yet

### CSV Import Cleanup (`src/components/ExcelUpload.tsx`)

- Filter out rows where both `removal_date` and `dbe` are null/empty during import
- Show a toast noting how many rows were skipped as non-data entries
