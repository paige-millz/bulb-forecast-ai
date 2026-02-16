import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
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
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
        return;
      }

      const records: BulbRecord[] = rows.map((row) => {
        const year = Number(row["Year"] ?? row["year"]);
        const bulb_type = String(row["Bulb Type"] ?? row["bulb_type"] ?? row["BulbType"] ?? "");
        const easter_raw = row["Easter Date"] ?? row["easter_date"] ?? row["EasterDate"];
        const removal_raw = row["Removal Date"] ?? row["removal_date"] ?? row["RemovalDate"];
        const easter_date = parseExcelDate(easter_raw);
        const removal_date = parseExcelDate(removal_raw) || null;

        let dbe = Number(row["DBE"] ?? row["dbe"] ?? 0) || null;
        if (!dbe && easter_date && removal_date) {
          dbe = diffDays(new Date(easter_date), new Date(removal_date));
        }

        const ship_raw = row["Ship Date"] ?? row["ship_date"];
        const avg_temp = parseFloat(row["avg_temp_from_removal_f"] ?? row["Avg Temp From Removal F"] ?? "");
        const degree_hours = parseFloat(row["degree_hours_above_40f"] ?? row["Degree Hours Above 40F"] ?? "");

        return {
          year,
          bulb_type,
          easter_date,
          removal_date,
          dbe,
          ship_date: ship_raw ? parseExcelDate(ship_raw) : null,
          avg_temp_from_removal_f: isNaN(avg_temp) ? null : avg_temp,
          degree_hours_above_40f: isNaN(degree_hours) ? null : degree_hours,
          yield_notes: row["yield_notes"] ?? row["Yield Notes"] ?? null,
          yield_quality: row["yield_quality"] ?? row["Yield Quality"] ?? null,
          grower_notes: row["grower_notes"] ?? row["Grower Notes"] ?? null,
          notes: row["Notes"] ?? row["notes"] ?? null,
        };
      });

      // Validate: need at least year, bulb_type, and easter_date
      // Also filter out junk rows with no removal_date AND no dbe
      const valid = records.filter(
        (r) => r.year > 0 && r.bulb_type && r.easter_date && (r.removal_date || r.dbe)
      );
      const skipped = records.length - valid.length;
      if (skipped > 0) {
        console.log(`Skipped ${skipped} rows without removal date or DBE`);
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

function parseExcelDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toISOString().split("T")[0];
}
