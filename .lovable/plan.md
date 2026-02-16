
# Calendar View for Suggested Removal Dates

## Overview
Add a new page that displays a monthly calendar with recommended removal dates color-coded by bulb type. The page will run the recommendation engine for all bulb types and plot results onto a visual calendar.

## New Route: `/calendar`

### How It Works
1. On page load, fetch all bulb types from the database
2. Run `callBulbRecommendations` for each type (same as "All Types" on the main page)
3. Render a calendar (using the existing `react-day-picker` / `Calendar` component) showing:
   - Each bulb type's recommended removal date as a colored marker/dot
   - The recommended window (start-end) as a highlighted date range
4. A legend below the calendar maps colors to bulb types
5. Clicking a date marker shows a popover with details (bulb type, median DBE, confidence, window)

### Navigation
- Add a "Calendar" button in the header nav alongside the existing "Weather" button
- Add the route to `App.tsx`

## Technical Details

### New Files
- **`src/pages/CalendarView.tsx`** -- Main page component
  - Reuses `fetchBulbTypes` and `callBulbRecommendations` from `src/lib/bulb-utils.ts`
  - Uses the existing `Calendar` component (`react-day-picker`) with custom `modifiers` and `modifiersStyles` to highlight removal dates per bulb type
  - Each bulb type gets a distinct color from a predefined palette
  - Uses `Popover` to show details when a highlighted date is clicked
  - Includes a color-coded legend and a target year selector

### Modified Files
- **`src/App.tsx`** -- Add `/calendar` route
- **`src/pages/Index.tsx`** -- Add a "Calendar" nav button in the header alongside the "Weather" button

### Calendar Rendering Approach
- Use `react-day-picker`'s `modifiers` prop to mark specific dates per bulb type
- Use `modifiersStyles` or custom `components.Day` renderer to show colored dots/badges on removal dates
- Show the recommended window as a subtle background highlight
- Default view month set to the recommended removal month

### Data Flow
```text
Page loads
  -> fetchBulbTypes()
  -> for each type: callBulbRecommendations(targetYear, type)
  -> parse recommendedRemovalDate + recommendedWindow from each response
  -> map to calendar modifiers with per-type colors
  -> render Calendar + Legend + detail Popovers
```
