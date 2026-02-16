import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, Trash2, AlertTriangle, CloudSun } from "lucide-react";
import bmfLogo from "@/assets/bmf-logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
import { DBEDistributionChart } from "@/components/DBEDistributionChart";
import { BulbRecordsTable } from "@/components/BulbRecordsTable";
import {
  computeEasterDate,
  formatDate,
  fetchBulbTypes,
  fetchBulbRecordCount,
  callBulbRecommendations,
  clearAllBulbRecords,
  exportCSV,
  exportJSON,
  downloadFile,
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
  const [bulbCount, setBulbCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<EdgeFunctionResponse | null>(null);

  const easter = computeEasterDate(targetYear);
  const easterStr = formatDate(easter);

  const refreshData = useCallback(async () => {
    const [types, count] = await Promise.all([
      fetchBulbTypes(),
      fetchBulbRecordCount(),
    ]);
    setBulbTypes(types);
    setBulbCount(count);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const resp = await callBulbRecommendations(targetYear, selectedBulb);
      if (resp.error) {
        toast({ title: "Error", description: resp.error, variant: "destructive" });
        setGenerating(false);
        return;
      }
      setResult(resp);
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
      setResult(null);
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
      <header className="border-b-2 border-primary/20 bg-card">
        <div className="container max-w-6xl py-3">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <img src={bmfLogo} alt="Blue Mountain Farms" className="h-52 mx-auto" />
              <div className="w-16 h-px bg-primary/30 mx-auto mt-2 mb-2" />
              <p className="text-sm text-muted-foreground">Easter Bulb Removal Planner</p>
            </div>

            {bulbCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5 absolute right-8">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Data
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
        {/* Notes / Warnings */}
        {result?.notes && result.notes.length > 0 && (
          <div className="space-y-2">
            {result.notes.map((note, i) => (
              <Alert key={i} className="border-accent/50 bg-accent/10">
                <AlertTriangle className="h-4 w-4 text-accent" />
                <AlertDescription className="text-accent-foreground">{note}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Input Row */}
        <div className="grid md:grid-cols-[1fr_1fr] gap-6">
          <div className="space-y-4">
            <ExcelUpload onUploadComplete={refreshData} />
            <WeatherUpload onUploadComplete={refreshData} />
          </div>

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

              <Button onClick={handleGenerate} disabled={generating || bulbTypes.length === 0} className="w-full">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Recommendation"
                )}
              </Button>

              {bulbTypes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">Upload data first</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPI Panel */}
        <KPIPanel data={result} easterDate={easterStr} />

        {/* Results */}
        {result && !result.error && (
          <>
            <RecommendationsTable data={result} />

            <DBEDistributionChart dbeValues={result.dbeValues} medianDBE={result.medianDBE} />

            {/* Export */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => downloadFile(exportCSV(result), "bulb-recommendation.csv", "text/csv")}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadFile(exportJSON(result), "bulb-recommendation.json", "application/json")}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </>
        )}

        {/* Bulb Records Table with inline editing */}
        <BulbRecordsTable />
      </main>
    </div>
  );
};

export default Index;
