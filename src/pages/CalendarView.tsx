import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2, Home, CloudSun, CalendarDays, Download } from "lucide-react";
import bmfLogo from "@/assets/bmf-logo.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  computeEasterDate,
  formatDate,
  fetchBulbTypes,
  callBulbRecommendations,
  type EdgeFunctionResponse,
} from "@/lib/bulb-utils";
import { supabase } from "@/integrations/supabase/client";

const BULB_COLORS = [
  "hsl(224, 55%, 41%)",
  "hsl(103, 23%, 40%)",
  "hsl(0, 55%, 48%)",
  "hsl(36, 80%, 50%)",
  "hsl(280, 50%, 50%)",
  "hsl(180, 50%, 40%)",
  "hsl(330, 60%, 50%)",
  "hsl(50, 80%, 45%)",
];

function getNextEasterYear(): number {
  const now = new Date();
  const thisEaster = computeEasterDate(now.getFullYear());
  return thisEaster > now ? now.getFullYear() : now.getFullYear() + 1;
}

interface BulbResult {
  response: EdgeFunctionResponse;
  color: string;
  removalDate: Date;
  windowStart: Date;
  windowEnd: Date;
  finishingDate: Date;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInRange(day: Date, start: Date, end: Date): boolean {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
}

// --- iCal helpers ---
function pad2(n: number) { return n.toString().padStart(2, "0"); }

function toICalDate(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function generateICal(results: BulbResult[], easter: Date): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blue Mountain Farms//Bulb Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  // Easter event
  lines.push(
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${toICalDate(easter)}`,
    `DTEND;VALUE=DATE:${toICalDate(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1))}`,
    `SUMMARY:Easter Sunday`,
    `UID:easter-${easter.getFullYear()}@bmf`,
    "END:VEVENT",
  );

  for (const r of results) {
    const bt = r.response.bulbType;
    // Removal date event
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${toICalDate(r.removalDate)}`,
      `DTEND;VALUE=DATE:${toICalDate(new Date(r.removalDate.getFullYear(), r.removalDate.getMonth(), r.removalDate.getDate() + 1))}`,
      `SUMMARY:${bt} — Remove from Cooler`,
      `DESCRIPTION:Median DBE: ${r.response.medianDBE}\\nConfidence: ${r.response.confidence}\\nWindow: ${r.response.recommendedWindow.start} to ${r.response.recommendedWindow.end}`,
      `UID:removal-${bt.replace(/\s/g, "-")}-${r.removalDate.getFullYear()}@bmf`,
      "END:VEVENT",
    );
    // Finishing date event
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${toICalDate(r.finishingDate)}`,
      `DTEND;VALUE=DATE:${toICalDate(new Date(r.finishingDate.getFullYear(), r.finishingDate.getMonth(), r.finishingDate.getDate() + 1))}`,
      `SUMMARY:${bt} — Ship By`,
      `UID:finish-${bt.replace(/\s/g, "-")}-${r.finishingDate.getFullYear()}@bmf`,
      "END:VEVENT",
    );
    // Window as multi-day event
    const windowEndNext = new Date(r.windowEnd.getFullYear(), r.windowEnd.getMonth(), r.windowEnd.getDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${toICalDate(r.windowStart)}`,
      `DTEND;VALUE=DATE:${toICalDate(windowEndNext)}`,
      `SUMMARY:${bt} — Removal Window`,
      `UID:window-${bt.replace(/\s/g, "-")}-${r.windowStart.getFullYear()}@bmf`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICal(results: BulbResult[], easter: Date) {
  const ics = generateICal(results, easter);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bulb-removal-${easter.getFullYear()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const WEEKDAYS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const CalendarView = () => {
  const [targetYear, setTargetYear] = useState(getNextEasterYear());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulbResult[]>([]);
  const [viewMonth, setViewMonth] = useState<number | null>(null);
  const [viewYear, setViewYear] = useState<number>(targetYear);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const easter = computeEasterDate(targetYear);
  const easterStr = formatDate(easter);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setResults([]);
    try {
      const types = await fetchBulbTypes();
      const { data: validData } = await supabase
        .from("bulb_records")
        .select("bulb_type")
        .not("removal_date", "is", null);
      const validSet = new Set(validData?.map((r) => r.bulb_type) || []);
      const validTypes = types.filter((t) => validSet.has(t));

      if (validTypes.length === 0) {
        toast({ title: "No data", description: "No bulb types have removal dates.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const responses = await Promise.all(
        validTypes.map((bt) => callBulbRecommendations(targetYear, bt))
      );

      const mapped: BulbResult[] = responses
        .filter((r) => !r.error)
        .map((r, i) => ({
          response: r,
          color: BULB_COLORS[i % BULB_COLORS.length],
          removalDate: new Date(r.recommendedRemovalDate + "T00:00:00"),
          windowStart: new Date(r.recommendedWindow.start + "T00:00:00"),
          windowEnd: new Date(r.recommendedWindow.end + "T00:00:00"),
          finishingDate: r.finishingDate ? new Date(r.finishingDate + "T00:00:00") : new Date(r.recommendedRemovalDate + "T00:00:00"),
        }));

      setResults(mapped);

      if (mapped.length > 0) {
        const earliest = mapped.reduce((a, b) => (a.removalDate < b.removalDate ? a : b));
        setViewMonth(earliest.removalDate.getMonth());
        setViewYear(earliest.removalDate.getFullYear());
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [targetYear]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const month = viewMonth ?? (easter.getMonth() - 1 >= 0 ? easter.getMonth() - 1 : 0);
  const totalDays = daysInMonth(viewYear, month);
  const firstDow = new Date(viewYear, month, 1).getDay();
  const days: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);

  const prevMonth = () => {
    if (month === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(month + 1);
  };

  const monthLabel = new Date(viewYear, month).toLocaleString("default", { month: "long", year: "numeric" });

  const getBulbsForDay = (dayNum: number) => {
    const date = new Date(viewYear, month, dayNum);
    return results.filter((r) => isSameDay(date, r.removalDate));
  };

  const getWindowsForDay = (dayNum: number) => {
    const date = new Date(viewYear, month, dayNum);
    return results.filter((r) => isInRange(date, r.windowStart, r.windowEnd));
  };

  const getFinishingForDay = (dayNum: number) => {
    const date = new Date(viewYear, month, dayNum);
    return results.filter((r) => isSameDay(date, r.finishingDate));
  };

  const weekdays = isMobile ? WEEKDAYS_SHORT : WEEKDAYS_FULL;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary/20 bg-card">
        <div className="container max-w-6xl px-3 sm:px-6 py-1">
          <div className="flex flex-col items-center">
            <div className="text-center w-full overflow-hidden">
              <img src={bmfLogo} alt="Blue Mountain Farms" className="h-48 sm:h-72 mx-auto -mb-16 sm:-mb-24 -mt-8 sm:-mt-16" />
              <p className="text-sm text-muted-foreground mt-3">Removal Date Calendar</p>
            </div>
            <div className="flex items-center gap-2 py-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/" className="gap-1">
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/weather" className="gap-1">
                  <CloudSun className="h-4 w-4" />
                  Weather
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
        {/* Year selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px] max-w-[200px]">
                <Label htmlFor="cal-year">Target Easter Year</Label>
                <Input
                  id="cal-year"
                  type="number"
                  value={targetYear}
                  onChange={(e) => setTargetYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                />
                <p className="text-xs text-muted-foreground mt-1">Easter: {easterStr}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={loadRecommendations} disabled={loading} size="sm">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
                {results.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadICal(results, easter)}
                    className="gap-1"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export iCal</span>
                    <span className="sm:hidden">.ics</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading recommendations…</span>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            {/* Calendar grid */}
            <Card>
              <CardHeader className="pb-2 px-2 sm:px-6">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={prevMonth} className="px-2 sm:px-3">
                    <span className="hidden sm:inline">← Prev</span>
                    <span className="sm:hidden">←</span>
                  </Button>
                  <CardTitle className="text-base sm:text-lg">{monthLabel}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={nextMonth} className="px-2 sm:px-3">
                    <span className="hidden sm:inline">Next →</span>
                    <span className="sm:hidden">→</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-1 sm:px-6">
                <div className="grid grid-cols-7 gap-px">
                  {weekdays.map((wd, i) => (
                    <div key={i} className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1 sm:py-2">
                      {wd}
                    </div>
                  ))}
                  {days.map((dayNum, idx) => {
                    if (dayNum === null) {
                      return <div key={`e-${idx}`} className="min-h-[3rem] sm:min-h-[5.5rem]" />;
                    }
                    const bulbs = getBulbsForDay(dayNum);
                    const windows = getWindowsForDay(dayNum);
                    const finishing = getFinishingForDay(dayNum);
                    const isEaster = isSameDay(new Date(viewYear, month, dayNum), easter);
                    const hasContent = bulbs.length > 0 || windows.length > 0 || finishing.length > 0;

                    const windowBg = windows.length > 0
                      ? `${windows[0].color.replace(")", ", 0.1)")}`
                      : undefined;

                    return (
                      <Popover key={dayNum} open={selectedDay ? isSameDay(selectedDay, new Date(viewYear, month, dayNum)) : false} onOpenChange={(open) => {
                        if (open) setSelectedDay(new Date(viewYear, month, dayNum));
                        else setSelectedDay(null);
                      }}>
                        <PopoverTrigger asChild>
                          <button
                            className={`min-h-[3rem] sm:min-h-[5.5rem] border border-border/50 rounded-sm sm:rounded-md p-0.5 sm:p-1 text-left transition-colors hover:bg-muted/50 relative overflow-hidden ${
                              isEaster ? "ring-2 ring-primary/40" : ""
                            }`}
                            style={windowBg ? { backgroundColor: windowBg } : undefined}
                            onClick={() => setSelectedDay(new Date(viewYear, month, dayNum))}
                          >
                            <span className={`text-[10px] sm:text-xs ${isEaster ? "font-bold text-primary" : "text-foreground"}`}>
                              {dayNum}
                            </span>
                            {isEaster && <span className="text-[8px] sm:text-[9px] text-primary block leading-tight">Easter</span>}
                            {/* Mobile: show colored dots only; Desktop: show labels */}
                            {isMobile ? (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {finishing.map((f, i) => (
                                  <span key={`fin-${i}`} className="w-1.5 h-1.5 rotate-45 border border-current" style={{ borderColor: f.color, backgroundColor: `${f.color.replace(")", ", 0.2)")}` }} />
                                ))}
                                {bulbs.map((b, i) => (
                                  <span key={`dot-${i}`} className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                                ))}
                                {bulbs.length === 0 && windows.length > 0 && (
                                  <div className="w-full h-0.5 rounded-full mt-0.5" style={{ backgroundColor: `${windows[0].color.replace(")", ", 0.35)")}` }} />
                                )}
                              </div>
                            ) : (
                              <>
                                {finishing.map((f, i) => (
                                  <div key={`fin-${i}`} className="flex items-center gap-1 mt-0.5">
                                    <span className="w-2 h-2 shrink-0 rotate-45 border border-current" style={{ borderColor: f.color, backgroundColor: `${f.color.replace(")", ", 0.2)")}` }} />
                                    <span className="text-[10px] font-medium leading-tight truncate" style={{ color: f.color }}>
                                      Finish
                                    </span>
                                  </div>
                                ))}
                                {bulbs.map((b, i) => (
                                  <div key={`dot-${i}`} className="flex items-center gap-1 mt-0.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                                    <span className="text-[10px] font-semibold leading-tight truncate" style={{ color: b.color }}>
                                      {b.response.bulbType}
                                    </span>
                                  </div>
                                ))}
                                {bulbs.length === 0 && windows.map((w, i) => (
                                  <div key={`win-${i}`} className="mt-0.5">
                                    <div className="h-1 rounded-full w-full" style={{ backgroundColor: `${w.color.replace(")", ", 0.35)")}` }} />
                                  </div>
                                ))}
                              </>
                            )}
                          </button>
                        </PopoverTrigger>
                        {hasContent && (
                          <PopoverContent className="w-64 sm:w-72 pointer-events-auto" side={isMobile ? "bottom" : "right"}>
                            <div className="space-y-3">
                              {bulbs.map((b, i) => (
                                <div key={`p-${i}`} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: b.color }} />
                                    <span className="font-semibold text-sm">{b.response.bulbType}</span>
                                    <Badge variant={b.response.confidence === "High" ? "default" : b.response.confidence === "Medium" ? "secondary" : "outline"} className="text-xs">
                                      {b.response.confidence}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-0.5 pl-5">
                                    <p>Removal: <strong>{b.response.recommendedRemovalDate}</strong></p>
                                    <p>Median DBE: <strong>{b.response.medianDBE}</strong></p>
                                    <p>Window: {b.response.recommendedWindow.start} → {b.response.recommendedWindow.end}</p>
                                    <p>Records: {b.response.nRecords}</p>
                                  </div>
                                </div>
                              ))}
                              {finishing.length > 0 && bulbs.length === 0 && finishing.map((f, i) => (
                                <div key={`fp-${i}`} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rotate-45 border-2 inline-block" style={{ borderColor: f.color }} />
                                    <span className="font-medium text-sm">{f.response.bulbType}</span>
                                    <span className="text-xs text-muted-foreground">(ship by)</span>
                                  </div>
                                </div>
                              ))}
                              {bulbs.length === 0 && finishing.length === 0 && windows.map((w, i) => (
                                <div key={`w-${i}`} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: w.color }} />
                                    <span className="font-medium text-sm">{w.response.bulbType}</span>
                                    <span className="text-xs text-muted-foreground">(window)</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground pl-5">
                                    <p>Removal: {w.response.recommendedRemovalDate}</p>
                                    <p>Window: {w.response.recommendedWindow.start} → {w.response.recommendedWindow.end}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                      <span>{r.response.bulbType}</span>
                      <span className="text-muted-foreground text-[10px] sm:text-xs">({r.response.recommendedRemovalDate})</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-3">
                  <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>Shaded = removal window · ● = removal date · ◆ = ship by date</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && results.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No recommendations available. Upload bulb records on the Dashboard first.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CalendarView;
