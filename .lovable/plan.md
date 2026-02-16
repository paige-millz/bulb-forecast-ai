

# Collapse Upload Controls After Data Is Loaded

## Overview

Move the weather and bulb data upload sections into a collapsible panel so they don't dominate the top of the page once historical data has been imported. The Configuration card and Generate button remain prominent.

## Changes

### `src/pages/Index.tsx`

- Wrap the `ExcelUpload` and `WeatherUpload` components in a Collapsible (from `@radix-ui/react-collapsible`) that defaults to **collapsed** when `bulbCount > 0` (data exists) and **expanded** when no data exists
- Add a trigger button labeled something like "Import Data" or "Data Sources" with a chevron indicator
- The Configuration card stays outside the collapsible, always visible

### Layout Adjustment

Current layout:
```text
[ ExcelUpload + WeatherUpload ]  [ Configuration ]
```

New layout when data exists:
```text
[ Configuration (full width or prominent) ]
[ v Import Data (collapsed) ]
```

New layout when no data:
```text
[ ExcelUpload + WeatherUpload ]  [ Configuration ]
```

This keeps the upload tools accessible but out of the way for day-to-day use.

