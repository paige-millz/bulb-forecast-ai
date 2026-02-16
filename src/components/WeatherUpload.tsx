import { useState, useCallback } from "react";
import { Upload, CloudSun, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  source?: string | null;
}

export function WeatherUpload({ onUploadComplete }: WeatherUploadProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [latitude, setLatitude] = useState("40.6895");
  const [longitude, setLongitude] = useState("-76.1245");

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
      const sourceIdx = headers.findIndex((h) => h === "source");

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
          source: sourceIdx >= 0 ? cols[sourceIdx] || "csv_upload" : "csv_upload",
        });
      }

      if (rows.length === 0) {
        toast({ title: "No valid rows", description: "Check CSV format.", variant: "destructive" });
        return;
      }

      // Route through edge function to use service role key
      const { data, error } = await supabase.functions.invoke("sync-weather", {
        body: { rows },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Weather data uploaded", description: `${data?.daysImported ?? rows.length} days imported.` });
      onUploadComplete();
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [onUploadComplete]);

  const handleApiSync = async () => {
    setSyncing(true);
    try {
      // Sync Feb 1 to Apr 30 for years 2013 through current year
      const currentYear = new Date().getFullYear();
      let totalImported = 0;

      const today = new Date().toISOString().split("T")[0];
      for (let year = 2013; year <= currentYear; year++) {
        const startDate = `${year}-02-01`;
        let endDate = `${year}-04-30`;
        if (endDate > today) endDate = today;

        const { data, error } = await supabase.functions.invoke("sync-weather", {
          body: { latitude: parseFloat(latitude), longitude: parseFloat(longitude), startDate, endDate },
        });
        if (error) throw error;
        if (data?.error) {
          console.warn(`Weather sync ${year}: ${data.error}`);
          continue;
        }
        totalImported += data?.daysImported ?? 0;
      }

      toast({ title: "Weather sync complete", description: `${totalImported} days synced from Open-Meteo (2013–${currentYear}).` });
      onUploadComplete();
    } catch (err: any) {
      toast({ title: "Sync error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CloudSun className="h-5 w-5 text-accent" />
          Weather Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CSV Upload */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Upload a CSV with columns: date, tavg_f, tmin_f, tmax_f
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
            <Button variant="outline" size="sm" disabled={loading || syncing} asChild>
              <span>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {loading ? "Uploading..." : "Upload Weather CSV"}
              </span>
            </Button>
          </label>
        </div>

        {/* API Sync */}
        <div className="border-t border-border pt-3">
          <p className="text-sm text-muted-foreground mb-2">
            Or sync from Open-Meteo API (free, no key needed)
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleApiSync} disabled={loading || syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {syncing ? "Syncing..." : "Sync from Open-Meteo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
