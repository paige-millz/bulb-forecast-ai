import { useState, useEffect, useCallback } from "react";
import { Flower2, Loader2, Download, Trash2, AlertTriangle, Info } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  fetchBulbRecordCount,
  fetchWeatherCount,
  callBulbRecommendations,
  edgeResponseToRecommendations,
  clearAllBulbRecords,
  exportCSV,
  exportJSON,
  downloadFile,
  type Recommendation,
  type EdgeFunctionResponse,
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
  const [bulbCount, setBulbCount] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [chartData, setChartData] = useState<{ dbe: number; tavg_f: number }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [edgeResponse, setEdgeResponse] = useState<EdgeFunctionResponse | null>(null);

  const easter = computeEasterDate(targetYear);
  const easterStr = formatDate(easter);

  const refreshData = useCallback(async () => {
    const [types, wCount, bCount] = await Promise.all([
      fetchBulbTypes(),
      fetchWeatherCount(),
      fetchBulbRecordCount(),
    ]);
    setBulbTypes(types);
    setWeatherCount(wCount);
    setBulbCount(bCount);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setEdgeResponse(null);
    try {
      const resp = await callBulbRecommendations(targetYear, selectedBulb, modelType);
      if (resp.error) {
        toast({ title: "Error", description: resp.error, variant: "destructive" });
        setGenerating(false);
        return;
      }
      setEdgeResponse(resp);
      const recs = edgeResponseToRecommendations(resp);
      setRecommendations(recs);
      // Map chartSeries to our chart format
      const chart = resp.chartSeries.map((c) => ({
        dbe: c.daysBeforeEaster,
        tavg_f: c.predictedTavgF,
      }));
      setChartData(chart);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await clearAllBulbRecords();
      toast({ title: "Data cleared", description: "All historical records removed." });
      setRecommendations([]);
      setChartData([]);
      setEdgeResponse(null);
      await refreshData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-6xl py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                <Flower2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl leading-tight">Easter Bulb Removal Planner</h1>
                <p className="text-sm text-muted-foreground">Predict optimal cooler removal timing</p>
              </div>
            </div>

            {bulbCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Historical Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {bulbCount} bulb records. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={clearing}
                    >
                      {clearing ? "Clearing..." : "Delete All Records"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
        {/* Weather upload — only when empty */}
        {weatherCount === 0 && (
          <WeatherUpload onUploadComplete={refreshData} />
        )}

        {/* Warnings/Notices */}
        {edgeResponse?.smallDatasetWarning && (
          <Alert className="border-accent/50 bg-accent/10">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <AlertDescription className="text-accent-foreground">
              {edgeResponse.smallDatasetWarning}
            </AlertDescription>
          </Alert>
        )}

        {edgeResponse?.fallbackNotice && (
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription>
              {edgeResponse.fallbackNotice}
            </AlertDescription>
          </Alert>
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
