import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2, Download, Trash2, AlertTriangle, CloudSun, ChevronDown } from "lucide-react";
import bmfLogo from "@/assets/bmf-logo.svg";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [results, setResults] = useState<EdgeFunctionResponse[]>([]);

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
    setResults([]);
    try {
      if (selectedBulb === "All" && bulbTypes.length > 0) {
        // Generate per-bulb-type recommendations
        const allResults = await Promise.all(
          bulbTypes.map((bt) => callBulbRecommendations(targetYear, bt))
        );
        const valid = allResults.filter((r) => !r.error);
        if (valid.length === 0) {
          toast({ title: "Error", description: "No recommendations could be generated.", variant: "destructive" });
        } else {
          setResults(valid);
        }
      } else {
        const resp = await callBulbRecommendations(targetYear, selectedBulb);
        if (resp.error) {
          toast({ title: "Error", description: resp.error, variant: "destructive" });
        } else {
          setResults([resp]);
        }
      }
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
      setResults([]);
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
        <div className="container max-w-6xl py-1">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <img src={bmfLogo} alt="Blue Mountain Farms" className="h-28 mx-auto" />
              <p className="text-sm text-muted-foreground mt-1">Easter Bulb Removal Planner</p>
            </div>
            <div className="flex items-center gap-2 absolute right-8">
              <Button variant="outline" size="sm" asChild>
                <Link to="/weather" className="gap-1">
                  <CloudSun className="h-4 w-4" />
                  Weather
                </Link>
              </Button>
              {bulbCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">
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
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
        {/* Notes / Warnings */}
        {results.length > 0 && results.some(r => r.notes?.length > 0) && (
          <div className="space-y-2">
            {[...new Set(results.flatMap(r => r.notes || []))].map((note, i) => (
              <Alert key={i} className="border-accent/50 bg-accent/10">
                <AlertTriangle className="h-4 w-4 text-accent" />
                <AlertDescription className="text-accent-foreground">{note}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Input Row */}
        {/* Configuration — always visible */}
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

        {/* Collapsible Data Sources */}
        <Collapsible defaultOpen={bulbCount === 0}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
                Data Sources
              </Button>
            </CollapsibleTrigger>
            {bulbCount > 0 && (
              <span className="text-xs text-muted-foreground">{bulbCount} records loaded</span>
            )}
          </div>
          <CollapsibleContent className="pt-3">
            <div className="grid md:grid-cols-2 gap-6">
              <ExcelUpload onUploadComplete={refreshData} />
              <WeatherUpload onUploadComplete={refreshData} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* KPI Panel — only for single bulb type */}
        {results.length === 1 && (
          <KPIPanel data={results[0]} easterDate={easterStr} />
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <RecommendationsTable data={results} />

            {results.length === 1 && (
              <DBEDistributionChart dbeValues={results[0].dbeValues} medianDBE={results[0].medianDBE} />
            )}

            {/* Export */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  const csv = results.map(r => exportCSV(r)).join("\n");
                  downloadFile(csv, "bulb-recommendation.csv", "text/csv");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadFile(JSON.stringify(results.length === 1 ? results[0] : results, null, 2), "bulb-recommendation.json", "application/json")}
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
