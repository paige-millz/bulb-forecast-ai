import { useState, useEffect, useCallback } from "react";
import { Flower2, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ExcelUpload } from "@/components/ExcelUpload";
import { WeatherUpload } from "@/components/WeatherUpload";
import { KPIPanel } from "@/components/KPIPanel";
import { RecommendationsTable } from "@/components/RecommendationsTable";
import { TempChart } from "@/components/TempChart";
import {
  computeEasterDate,
  formatDate,
  fetchBulbTypes,
  fetchWeatherCount,
  generateRecommendations,
  fetchWeatherForChart,
  exportCSV,
  exportJSON,
  downloadFile,
  type Recommendation,
} from "@/lib/bulb-utils";

function getNextEasterYear(): number {
  const now = new Date();
  const thisEaster = computeEasterDate(now.getFullYear());
  return thisEaster > now ? now.getFullYear() : now.getFullYear() + 1;
}

const Index = () => {
  const [targetYear, setTargetYear] = useState(getNextEasterYear());
  const [bulbTypes, setBulbTypes] = useState<string[]>([]);
  const [selectedBulb, setSelectedBulb] = useState("All");
  const [modelType, setModelType] = useState<"overall" | "by-year">("overall");
  const [weatherCount, setWeatherCount] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [chartData, setChartData] = useState<{ dbe: number; tavg_f: number }[]>([]);
  const [generating, setGenerating] = useState(false);

  const easter = computeEasterDate(targetYear);
  const easterStr = formatDate(easter);

  const refreshData = useCallback(async () => {
    const [types, wCount] = await Promise.all([fetchBulbTypes(), fetchWeatherCount()]);
    setBulbTypes(types);
    setWeatherCount(wCount);
    if (types.length > 0 && selectedBulb === "All") {
      // keep All
    }
  }, [selectedBulb]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const [recs, weather] = await Promise.all([
        generateRecommendations(targetYear, selectedBulb, modelType),
        fetchWeatherForChart(targetYear),
      ]);
      setRecommendations(recs);
      setChartData(weather);
      if (recs.length === 0) {
        toast({ title: "No data", description: "No matching bulb records found.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-6xl py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
              <Flower2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl leading-tight">Easter Bulb Removal Planner</h1>
              <p className="text-sm text-muted-foreground">Predict optimal cooler removal timing</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
        {/* Weather upload — only when empty */}
        {weatherCount === 0 && (
          <WeatherUpload onUploadComplete={refreshData} />
        )}

        {/* Input Row */}
        <div className="grid md:grid-cols-[1fr_1fr] gap-6">
          <ExcelUpload onUploadComplete={refreshData} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target-year">Target Easter Year</Label>
                  <Input
                    id="target-year"
                    type="number"
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                    min={2000}
                    max={2100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Easter: {easterStr}</p>
                </div>

                <div>
                  <Label>Bulb Type</Label>
                  <Select value={selectedBulb} onValueChange={setSelectedBulb}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      {bulbTypes.map((bt) => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Model Type</Label>
                <Select value={modelType} onValueChange={(v) => setModelType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall Model</SelectItem>
                    <SelectItem value="by-year">By-Year Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerate} disabled={generating || bulbTypes.length === 0} className="w-full">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Recommendations"
                )}
              </Button>

              {bulbTypes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">Upload Excel data first</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPI Panel */}
        <KPIPanel
          recommendation={recommendations.length > 0 ? recommendations[0] : null}
          easterDate={easterStr}
        />

        {/* Results */}
        {recommendations.length > 0 && (
          <>
            <RecommendationsTable data={recommendations} />

            <TempChart data={chartData} />

            {/* Export */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  downloadFile(exportCSV(recommendations), "bulb-recommendations.csv", "text/csv");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  downloadFile(exportJSON(recommendations), "bulb-recommendations.json", "application/json");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
