

# Fix: Clean Up Junk Bulb Records and Prevent Future Bad Imports

## Problem
The database contains non-data rows imported from the CSV (grower notes, chemical application notes, "Additional Notes:" headers). When "All Types" is selected, the recommendation engine tries to process each one, generating misleading warnings.

Affected junk entries:
- "Additional Notes:"
- "2025 bonzi tulips 20 ppm drench 3-4 days out"
- "2025 florel drench hyac 500 ppm =3 gal florel 2 gal water 2x"
- "tulip ovals early" (has no removal dates or DBE in any year)

## Solution (3 parts)

### 1. Clean existing database
Run a migration to delete all bulb_records rows that have no `removal_date` AND no `dbe` value, since these are not actionable data.

### 2. Harden the CSV import filter
Update `ExcelUpload.tsx` to add stricter validation:
- Keep the existing filter (must have `removal_date` or `dbe`)
- Add a check that `bulb_type` does not look like a notes/comment row (e.g., starts with a year like "2025 ..." or contains "Notes:" as a substring)

### 3. Filter junk in the "All Types" generation flow
Update `Index.tsx` so that when generating recommendations for "All Types", only bulb types that have at least one record with a valid `removal_date` or `dbe` are included. This prevents the engine from even attempting to process note-like entries.

## Technical Details

**Database cleanup SQL:**
```sql
DELETE FROM bulb_records
WHERE removal_date IS NULL AND dbe IS NULL;
```

**ExcelUpload.tsx** -- enhance the `valid` filter (~line 65):
```typescript
const valid = records.filter(
  (r) =>
    r.year > 0 &&
    r.bulb_type &&
    r.easter_date &&
    (r.removal_date || r.dbe) &&
    !/^(additional|notes)/i.test(r.bulb_type.trim()) &&
    !/^\d{4}\s+\w/.test(r.bulb_type.trim()) // skip "2025 bonzi..." style notes
);
```

**Index.tsx** -- filter bulb types before generating (~line 85):
Query only bulb types that have at least one record with a non-null `removal_date` or `dbe`, so note-only entries are excluded from the "All" run. This can be done by fetching valid types from the database using a filtered query, or by filtering the `bulbTypes` list against a subquery.

**bulb-utils.ts** -- update `fetchBulbTypes` to only return types that have actual data:
```typescript
export async function fetchBulbTypes(): Promise<string[]> {
  const { data } = await supabase
    .from("bulb_records")
    .select("bulb_type")
    .not("removal_date", "is", null)
    .order("bulb_type");
  if (!data) return [];
  return [...new Set(data.map((r) => r.bulb_type))];
}
```

This is the most impactful single change -- it ensures only bulb types with real removal data appear in the dropdown and in "All Types" generation.

