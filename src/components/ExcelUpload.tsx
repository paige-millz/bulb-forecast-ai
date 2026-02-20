import { useState, useCallback } from "react";
import ExcelJS from "exceljs";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { clearAndInsertBulbRecords, diffDays, type BulbRecord } from "@/lib/bulb-utils";

interface ExcelUploadProps {
  onUploadComplete: () => void;
}

export function ExcelUpload({ onUploadComplete }: ExcelUploadProps) {
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const isCSV = file.name.toLowerCase().endsWith(".csv");
      let rows: Record<string, any>[] = [];

      if (isCSV) {
        const text = await file.text();
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim());
        rows = lines.slice(1).map((line) => {
          const cols = line.split(",").map((c) => c.trim());
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { obj[h] = cols[i]; });
          return obj;
        });
      } else {
        // xlsx / xls via ExcelJS
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell) => {
          headers.push(String(cell.value ?? "").trim());
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const obj: Record<string, any> = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) obj[header] = cell.value;
          });
          rows.push(obj);
        });
      }

      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
        return;
      }

      const records: BulbRecord[] = rows.map((row) => {
        const year = Number(row["Year"] ?? row["year"]);
        const bulb_type = String(row["Bulb Type"] ?? row["bulb_type"] ?? row["BulbType"] ?? "");
        const easter_raw = row["Easter Date"] ?? row["easter_date"] ?? row["EasterDate"];
        const removal_raw = row["Removal Date"] ?? row["removal_date"] ?? row["RemovalDate"];
        const easter_date = parseCellDate(easter_raw);
        const removal_date = parseCellDate(removal_raw) || null;

        const dbeRaw = row["DBE"] ?? row["dbe"];
        let dbe: number | null = dbeRaw != null && dbeRaw !== "" ? Number(dbeRaw) : null;
        if (dbe == null && easter_date && removal_date) {
          dbe = diffDays(new Date(easter_date + "T00:00:00"), new Date(removal_date + "T00:00:00"));
        }

        const ship_raw = row["Ship Date"] ?? row["ship_date"];
        const avg_temp = parseFloat(String(row["avg_temp_from_removal_f"] ?? row["Avg Temp From Removal F"] ?? ""));
        const degree_hours = parseFloat(String(row["degree_hours_above_40f"] ?? row["Degree Hours Above 40F"] ?? ""));

        return {
          year,
          bulb_type,
          easter_date,
          removal_date,
          dbe,
          ship_date: ship_raw ? parseCellDate(ship_raw) : null,
          avg_temp_from_removal_f: isNaN(avg_temp) ? null : avg_temp,
          degree_hours_above_40f: isNaN(degree_hours) ? null : degree_hours,
          yield_notes: row["yield_notes"] ?? row["Yield Notes"] ?? null,
          yield_quality: row["yield_quality"] ?? row["Yield Quality"] ?? null,
          grower_notes: row["grower_notes"] ?? row["Grower Notes"] ?? null,
          notes: row["Notes"] ?? row["notes"] ?? null,
        };
      });

      const valid = records.filter(
        (r) => r.year > 0 && r.bulb_type && r.easter_date
      );
      const skipped = records.length - valid.length;
      if (skipped > 0) {
        console.log(`Skipped ${skipped} rows without required fields`);
      }

      if (valid.length === 0) {
        toast({ title: "No valid rows", description: "Check column headers: Year, Bulb Type, Easter Date, Removal Date", variant: "destructive" });
        return;
      }

      await clearAndInsertBulbRecords(valid);

      const years = [...new Set(valid.map((r) => r.year))].sort();
      const types = [...new Set(valid.map((r) => r.bulb_type))];
      const skippedCount = records.length - valid.length;
      toast({
        title: "Upload complete",
        description: `${valid.length} records imported${skippedCount > 0 ? ` (${skippedCount} rows skipped — no removal date or DBE)` : ""}. Years: ${years[0]}–${years[years.length - 1]}. ${types.length} bulb types.`,
      });
      onUploadComplete();
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Upload Historical Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {loading ? "Processing..." : "Drop Excel/CSV file here or click to browse"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
            }}
          />
          {!loading && (
            <Button variant="outline" size="sm" type="button">
              Choose File
            </Button>
          )}
        </label>
      </CardContent>
    </Card>
  );
}

/** Parse an ExcelJS cell value or string into YYYY-MM-DD */
function parseCellDate(val: any): string {
  if (!val) return "";
  // ExcelJS returns JS Date objects for date cells
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    return val.toISOString().split("T")[0];
  }
  // ExcelJS rich text object
  if (typeof val === "object" && val.text) {
    return parseCellDate(val.text);
  }
  // Plain string or number string
  const d = new Date(String(val));
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return String(val);
}
