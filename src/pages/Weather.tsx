import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CloudSun, Loader2, Download, TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeEasterDate, formatDate, downloadFile } from "@/lib/bulb-utils";
import bmfLogo from "@/assets/bmf-logo.svg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const YEAR_COLORS = [
  "hsl(224, 55%, 41%)",
  "hsl(221, 38%, 54%)",
  "hsl(103, 23%, 40%)",
  "hsl(0, 55%, 48%)",
  "hsl(30, 70%, 50%)",
  "hsl(280, 45%, 50%)",
  "hsl(180, 40%, 40%)",
  "hsl(50, 65%, 45%)",
  "hsl(330, 50%, 45%)",
  "hsl(150, 40%, 35%)",
  "hsl(200, 60%, 45%)",
  "hsl(260, 40%, 55%)",
];

// Farm coordinates (New Ringgold, PA)
const LAT = 40.6895;
const LNG = -76.1245;

function getNextEasterYear(): number {
  const now = new Date();
  const thisEaster = computeEasterDate(now.getFullYear());
  return thisEaster > now ? now.getFullYear() : now.getFullYear() + 1;
}

function dayOfSeason(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const feb1 = new Date(d.getFullYear(), 1, 1);
  return Math.round((d.getTime() - feb1.getTime()) / (1000 * 60 * 60 * 24));
}

interface WeatherRow {
  date: string;
  tavg_f: number;
  tmin_f: number | null;
  tmax_f: number | null;
}

interface ForecastDay {
  date: string;
  tavg: number | null;
  tmin: number | null;
  tmax: number | null;
}

const Weather = () => {
  const [historicalData, setHistoricalData] = useState<WeatherRow[]>([]);
  const [forecastData, setForecastData] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(true);

  const nextEasterYear = getNextEasterYear();
  const nextEaster = computeEasterDate(nextEasterYear);
  const easterStr = formatDate(nextEaster);

  // Fetch historical data
  useEffect(() => {
    const fetchHistorical = async () => {
      setLoading(true);
      let allData: WeatherRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("weather_daily")
          .select("date, tavg_f, tmin_f, tmax_f")
          .order("date", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setHistoricalData(allData);
      setLoading(false);
    };
    fetchHistorical();
  }, []);

  // Fetch forecast
  useEffect(() => {
    const fetchForecast = async () => {
      setForecastLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("sync-weather", {
          body: { forecast: true, latitude: LAT, longitude: LNG },
        });
        if (error) throw error;
        const dates: string[] = data?.daily?.time ?? [];
        const tavg: (number | null)[] = data?.daily?.temperature_2m_mean ?? [];
        const tmin: (number | null)[] = data?.daily?.temperature_2m_min ?? [];
        const tmax: (number | null)[] = data?.daily?.temperature_2m_max ?? [];
        setForecastData(
          dates.map((d, i) => ({ date: d, tavg: tavg[i], tmin: tmin[i], tmax: tmax[i] }))
        );
      } catch (err) {
        console.error("Forecast error:", err);
      } finally {
        setForecastLoading(false);
      }
    };
    fetchForecast();
  }, []);

  // Group historical data by year, filter Feb-Apr
  const { chartData, years } = useMemo(() => {
    const yearMap: Record<number, Record<number, number>> = {};
    for (const row of historicalData) {
      const d = new Date(row.date + "T00:00:00");
      const month = d.getMonth();
      if (month < 1 || month > 3) continue;
      const year = d.getFullYear();
      const dos = dayOfSeason(row.date);
      if (!yearMap[year]) yearMap[year] = {};
      yearMap[year][dos] = row.tavg_f;
    }

    const allYears = Object.keys(yearMap).map(Number).sort();
    const allDays = new Set<number>();
    for (const y of allYears) {
      for (const d of Object.keys(yearMap[y])) allDays.add(Number(d));
    }
    const sortedDays = [...allDays].sort((a, b) => a - b);

    const chartData = sortedDays.map((dos) => {
      const entry: Record<string, any> = { dos };
      const approxDate = new Date(2024, 1, 1);
      approxDate.setDate(approxDate.getDate() + dos);
      entry.label = approxDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      for (const y of allYears) {
        entry[`y${y}`] = yearMap[y][dos] ?? null;
      }
      return entry;
    });

    return { chartData, years: allYears };
  }, [historicalData]);

  // Forecast chart data
  const forecastChartData = useMemo(() => {
    return forecastData.map((d) => ({
      date: d.date,
      label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tavg: d.tavg,
      tmin: d.tmin,
      tmax: d.tmax,
    }));
  }, [forecastData]);

  // Easter day-of-season for reference line on historical chart
  const easterDOS = useMemo(() => {
    const e = computeEasterDate(nextEasterYear);
    const feb1 = new Date(nextEasterYear, 1, 1);
    return Math.round((e.getTime() - feb1.getTime()) / (1000 * 60 * 60 * 24));
  }, [nextEasterYear]);

  // Easter week comparison data
  const easterWeekComparison = useMemo(() => {
    const easterDate = computeEasterDate(nextEasterYear);
    const easterMs = easterDate.getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    // Forecast Easter week avg
    let forecastAvg: number | null = null;
    const forecastInWindow = forecastData.filter((d) => {
      const dMs = new Date(d.date + "T00:00:00").getTime();
      return Math.abs(dMs - easterMs) <= threeDaysMs && d.tavg !== null;
    });
    if (forecastInWindow.length > 0) {
      forecastAvg =
        forecastInWindow.reduce((sum, d) => sum + (d.tavg ?? 0), 0) / forecastInWindow.length;
    }

    // Historical Easter week avgs per year
    const uniqueYears = [...new Set(historicalData.map((r) => new Date(r.date + "T00:00:00").getFullYear()))].sort(
      (a, b) => b - a
    );
    const historicalByYear: { year: number; easterDate: string; avg: number | null }[] = [];

    for (const year of uniqueYears) {
      const yearEaster = computeEasterDate(year);
      const yearEasterMs = yearEaster.getTime();
      const inWindow = historicalData.filter((r) => {
        const rMs = new Date(r.date + "T00:00:00").getTime();
        return Math.abs(rMs - yearEasterMs) <= threeDaysMs;
      });
      if (inWindow.length >= 3) {
        const avg = inWindow.reduce((s, r) => s + r.tavg_f, 0) / inWindow.length;
        historicalByYear.push({ year, easterDate: formatDate(yearEaster), avg });
      }
    }

    // Overall historical mean
    const validAvgs = historicalByYear.filter((h) => h.avg !== null).map((h) => h.avg as number);
    const overallHistoricalAvg =
      validAvgs.length > 0 ? validAvgs.reduce((s, v) => s + v, 0) / validAvgs.length : null;

    return { forecastAvg, historicalByYear, overallHistoricalAvg };
  }, [historicalData, forecastData, nextEasterYear]);

  // CSV export helpers
  const exportForecastCSV = () => {
    const header = "date,avg_f,min_f,max_f";
    const rows = forecastData.map(
      (d) => `${d.date},${d.tavg ?? ""},${d.tmin ?? ""},${d.tmax ?? ""}`
    );
    downloadFile([header, ...rows].join("\n"), "forecast_weather.csv", "text/csv");
  };

  const exportHistoricalCSV = () => {
    const header = "date,tavg_f,tmin_f,tmax_f";
    const rows = historicalData.map(
      (r) => `${r.date},${r.tavg_f},${r.tmin_f ?? ""},${r.tmax_f ?? ""}`
    );
    downloadFile([header, ...rows].join("\n"), "historical_weather.csv", "text/csv");
  };

  const diff =
    easterWeekComparison.forecastAvg !== null && easterWeekComparison.overallHistoricalAvg !== null
      ? easterWeekComparison.forecastAvg - easterWeekComparison.overallHistoricalAvg
      : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary/20 bg-card">
        <div className="container max-w-6xl px-3 sm:px-6 py-1">
          <div className="flex flex-col items-center">
            <div className="text-center w-full overflow-hidden">
              <img src={bmfLogo} alt="Blue Mountain Farms" className="h-48 sm:h-72 mx-auto -mb-16 sm:-mb-24 -mt-8 sm:-mt-16" />
              <p className="text-sm text-muted-foreground mt-1">Weather Insights</p>
            </div>
            <div className="py-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Planner
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Easter Forecast */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="h-5 w-5 text-primary" />
                16-Day Forecast — Easter {nextEasterYear} ({easterStr})
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportForecastCSV}
              disabled={forecastData.length === 0}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            {forecastLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : forecastChartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No forecast data available.</p>
            ) : (
              <div className="h-[280px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis unit="°F" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(value: number, name: string) => [
                        `${value?.toFixed(1)}°F`,
                        name === "tavg" ? "Avg" : name === "tmin" ? "Min" : "Max",
                      ]}
                      labelFormatter={(label) => label}
                    />
                    <Area type="monotone" dataKey="tmax" stroke="none" fill="hsl(224, 55%, 41%)" fillOpacity={0.1} name="Max" />
                    <Area type="monotone" dataKey="tmin" stroke="none" fill="hsl(0, 0%, 100%)" fillOpacity={1} name="Min" />
                    <Line type="monotone" dataKey="tavg" stroke="hsl(224, 55%, 41%)" strokeWidth={2} dot={false} name="Avg" />
                    <Line type="monotone" dataKey="tmax" stroke="hsl(0, 55%, 48%)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Max" />
                    <Line type="monotone" dataKey="tmin" stroke="hsl(221, 38%, 54%)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Min" />
                    {forecastChartData.some((d) => d.date === easterStr) && (
                      <ReferenceLine
                        x={new Date(easterStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        stroke="hsl(103, 23%, 40%)"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        label={{ value: "Easter", position: "top", fill: "hsl(103, 23%, 40%)", fontSize: 12 }}
                      />
                    )}
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Easter Week Comparison Card */}
        <Card>
          <CardHeader>
            <CardTitle>Easter Week Temperature Comparison</CardTitle>
            <CardDescription>Easter ±3 days average temperature — forecast vs. historical</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || forecastLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground mb-1">Forecast ({nextEasterYear})</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {easterWeekComparison.forecastAvg !== null
                          ? `${easterWeekComparison.forecastAvg.toFixed(1)}°F`
                          : "N/A"}
                      </span>
                      {diff !== null && (
                        <span
                          className={`flex items-center gap-0.5 text-sm font-medium ${
                            diff > 0 ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(diff).toFixed(1)}°F
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      Historical Avg ({easterWeekComparison.historicalByYear.length} years)
                    </p>
                    <span className="text-2xl font-bold">
                      {easterWeekComparison.overallHistoricalAvg !== null
                        ? `${easterWeekComparison.overallHistoricalAvg.toFixed(1)}°F`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Year-by-year table */}
                {easterWeekComparison.historicalByYear.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead>Easter Date</TableHead>
                          <TableHead className="text-right">Avg Temp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {easterWeekComparison.historicalByYear.map((h) => (
                          <TableRow key={h.year}>
                            <TableCell className="font-medium">{h.year}</TableCell>
                            <TableCell>
                              {new Date(h.easterDate + "T00:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              {h.avg !== null ? `${h.avg.toFixed(1)}°F` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historical Year-over-Year */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Historical Temperatures (Feb – Apr)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={exportHistoricalCSV}
              disabled={historicalData.length === 0}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No historical weather data. Import data on the Planner page.
              </p>
            ) : (
              <div className="h-[300px] sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={6} />
                    <YAxis unit="°F" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(value: number, name: string) => [
                        `${value?.toFixed(1)}°F`,
                        name.replace("y", ""),
                      ]}
                      labelFormatter={(label) => label}
                    />
                    {years.map((y, i) => (
                      <Line
                        key={y}
                        type="monotone"
                        dataKey={`y${y}`}
                        stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        name={`${y}`}
                        connectNulls
                      />
                    ))}
                    <ReferenceLine
                      x={(() => {
                        const approx = new Date(2024, 1, 1);
                        approx.setDate(approx.getDate() + easterDOS);
                        return approx.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      })()}
                      stroke="hsl(103, 23%, 40%)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      label={{ value: `Easter ${nextEasterYear}`, position: "top", fill: "hsl(103, 23%, 40%)", fontSize: 12 }}
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Weather;
