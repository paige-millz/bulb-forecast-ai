import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CloudSun, Loader2 } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeEasterDate, formatDate } from "@/lib/bulb-utils";
import bmfLogo from "@/assets/bmf-logo.png";

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
      // Fetch all weather records (paginate if needed)
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
      const month = d.getMonth(); // 0-indexed
      if (month < 1 || month > 3) continue; // Feb(1) to Apr(3)
      const year = d.getFullYear();
      const dos = dayOfSeason(row.date);
      if (!yearMap[year]) yearMap[year] = {};
      yearMap[year][dos] = row.tavg_f;
    }

    const allYears = Object.keys(yearMap).map(Number).sort();
    // Build chart data: one entry per day-of-season
    const allDays = new Set<number>();
    for (const y of allYears) {
      for (const d of Object.keys(yearMap[y])) allDays.add(Number(d));
    }
    const sortedDays = [...allDays].sort((a, b) => a - b);

    const chartData = sortedDays.map((dos) => {
      const entry: Record<string, any> = { dos };
      // Create a readable label (approximate date from day-of-season)
      const approxDate = new Date(2024, 1, 1); // Use a leap year for label
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary/20 bg-card">
        <div className="container max-w-6xl py-1">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Planner
              </Link>
            </Button>
            <div className="text-center flex-1">
              <img src={bmfLogo} alt="Blue Mountain Farms" className="h-52 mx-auto -my-6" />
              <div className="w-16 h-px bg-primary/30 mx-auto mt-1 mb-1" />
              <p className="text-sm text-muted-foreground">Weather Insights</p>
            </div>
            <div className="w-20" /> {/* spacer for centering */}
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
        {/* Easter Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-primary" />
              16-Day Forecast — Easter {nextEasterYear} ({easterStr})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : forecastChartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No forecast data available.</p>
            ) : (
              <div className="h-[350px]">
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
                    <Area
                      type="monotone"
                      dataKey="tmax"
                      stroke="none"
                      fill="hsl(224, 55%, 41%)"
                      fillOpacity={0.1}
                      name="Max"
                    />
                    <Area
                      type="monotone"
                      dataKey="tmin"
                      stroke="none"
                      fill="hsl(0, 0%, 100%)"
                      fillOpacity={1}
                      name="Min"
                    />
                    <Line type="monotone" dataKey="tavg" stroke="hsl(224, 55%, 41%)" strokeWidth={2} dot={false} name="Avg" />
                    <Line type="monotone" dataKey="tmax" stroke="hsl(0, 55%, 48%)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Max" />
                    <Line type="monotone" dataKey="tmin" stroke="hsl(221, 38%, 54%)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Min" />
                    {/* Easter reference line */}
                    {forecastChartData.some(
                      (d) => d.date === easterStr
                    ) && (
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

        {/* Historical Year-over-Year */}
        <Card>
          <CardHeader>
            <CardTitle>Historical Temperatures (Feb – Apr)</CardTitle>
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
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      interval={6}
                    />
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
