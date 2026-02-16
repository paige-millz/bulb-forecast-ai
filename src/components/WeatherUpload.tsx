import { useState, useCallback } from "react";
import { Upload, CloudSun, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WeatherUploadProps {
  onUploadComplete: () => void;
}

interface WeatherRow {
  date: string;
  tavg_f: number;
  tmin_f?: number | null;
  tmax_f?: number | null;
}

export function WeatherUpload({ onUploadComplete }: WeatherUploadProps) {
  const [loading, setLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const dateIdx = headers.findIndex((h) => h === "date");
      const tavgIdx = headers.findIndex((h) => h.includes("tavg") || h.includes("avg"));
      const tminIdx = headers.findIndex((h) => h.includes("tmin") || h.includes("min"));
      const tmaxIdx = headers.findIndex((h) => h.includes("tmax") || h.includes("max"));

      if (dateIdx === -1 || tavgIdx === -1) {
        toast({ title: "Invalid CSV", description: "Needs 'date' and 'tavg' columns.", variant: "destructive" });
        return;
      }

      const rows: WeatherRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const tavg = parseFloat(cols[tavgIdx]);
        if (isNaN(tavg)) continue;
        rows.push({
          date: cols[dateIdx],
          tavg_f: tavg,
          tmin_f: tminIdx >= 0 ? parseFloat(cols[tminIdx]) || null : null,
          tmax_f: tmaxIdx >= 0 ? parseFloat(cols[tmaxIdx]) || null : null,
        });
      }

      if (rows.length === 0) {
        toast({ title: "No valid rows", description: "Check CSV format.", variant: "destructive" });
        return;
      }

      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("weather_daily").upsert(chunk, { onConflict: "date" });
        if (error) throw error;
      }

      toast({ title: "Weather data uploaded", description: `${rows.length} days imported.` });
      onUploadComplete();
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [onUploadComplete]);

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CloudSun className="h-5 w-5 text-accent" />
          Upload Weather CSV
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          No weather data found. Upload a CSV with columns: date, tavg (°F), tmin, tmax.
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
            }}
          />
          <Button variant="outline" size="sm" disabled={loading} asChild>
            <span>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {loading ? "Uploading..." : "Upload Weather CSV"}
            </span>
          </Button>
        </label>
      </CardContent>
    </Card>
  );
}
