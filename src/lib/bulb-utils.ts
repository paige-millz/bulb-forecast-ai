import { supabase } from "@/integrations/supabase/client";

export interface BulbRecord {
  id?: string;
  year: number;
  bulb_type: string;
  easter_date: string;
  removal_date: string;
  dbe: number;
  notes?: string | null;
}

export interface WeatherDaily {
  id?: number;
  date: string;
  tavg_f: number;
  tmin_f?: number | null;
  tmax_f?: number | null;
}

export interface Recommendation {
  bulb_type: string;
  easter_date: string;
  avg_dbe: number;
  recommended_removal: string;
  window_start: string;
  window_end: string;
  records_used: number;
  model_type: string;
}

// Easter calculation (Anonymous Gregorian algorithm)
export function computeEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function fetchBulbTypes(): Promise<string[]> {
  const { data } = await supabase
    .from("bulb_records")
    .select("bulb_type")
    .order("bulb_type");
  if (!data) return [];
  const unique = [...new Set(data.map((r) => r.bulb_type))];
  return unique;
}

export async function fetchWeatherCount(): Promise<number> {
  const { count } = await supabase
    .from("weather_daily")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function clearAndInsertBulbRecords(records: BulbRecord[]) {
  await supabase.from("bulb_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // batch insert in chunks of 500
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500).map(({ id, ...r }) => r);
    const { error } = await supabase.from("bulb_records").insert(chunk);
    if (error) throw error;
  }
}

export async function upsertWeatherData(rows: WeatherDaily[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(({ id, ...r }) => r);
    const { error } = await supabase.from("weather_daily").upsert(chunk, { onConflict: "date" });
    if (error) throw error;
  }
}

export async function generateRecommendations(
  targetYear: number,
  bulbType: string,
  modelType: "overall" | "by-year"
): Promise<Recommendation[]> {
  // Fetch records
  let query = supabase.from("bulb_records").select("*");
  if (bulbType !== "All") {
    query = query.eq("bulb_type", bulbType);
  }
  const { data: records } = await query;
  if (!records || records.length === 0) return [];

  const easter = computeEasterDate(targetYear);

  if (bulbType === "All") {
    // Group by bulb_type
    const groups: Record<string, typeof records> = {};
    for (const r of records) {
      if (!groups[r.bulb_type]) groups[r.bulb_type] = [];
      groups[r.bulb_type].push(r);
    }
    return Object.entries(groups).map(([bt, recs]) =>
      computeRec(bt, recs, easter, modelType, targetYear)
    );
  }

  return [computeRec(bulbType, records, easter, modelType, targetYear)];
}

function computeRec(
  bulbType: string,
  records: any[],
  easter: Date,
  modelType: "overall" | "by-year",
  targetYear: number
): Recommendation {
  let filtered = records;
  if (modelType === "by-year") {
    // weight more recent years more heavily — but if only one year matches, use all
    const yearRecords = records.filter((r) => r.year === targetYear - 1);
    if (yearRecords.length > 0) filtered = yearRecords;
  }

  const avgDbe =
    filtered.reduce((sum: number, r: any) => sum + Number(r.dbe), 0) / filtered.length;
  const roundedDbe = Math.round(avgDbe);
  const removal = addDays(easter, -roundedDbe);

  return {
    bulb_type: bulbType,
    easter_date: formatDate(easter),
    avg_dbe: Math.round(avgDbe * 10) / 10,
    recommended_removal: formatDate(removal),
    window_start: formatDate(addDays(removal, -2)),
    window_end: formatDate(addDays(removal, 2)),
    records_used: filtered.length,
    model_type: modelType === "overall" ? "Overall" : "By-Year",
  };
}

export async function fetchWeatherForChart(
  targetYear: number
): Promise<{ dbe: number; tavg_f: number }[]> {
  const easter = computeEasterDate(targetYear);
  const startDate = addDays(easter, -60);

  const { data } = await supabase
    .from("weather_daily")
    .select("date, tavg_f")
    .gte("date", formatDate(startDate))
    .lte("date", formatDate(easter))
    .order("date");

  if (!data) return [];

  return data.map((r) => ({
    dbe: diffDays(easter, new Date(r.date)),
    tavg_f: Number(r.tavg_f),
  }));
}

export function exportCSV(recommendations: Recommendation[]): string {
  const headers = Object.keys(recommendations[0]).join(",");
  const rows = recommendations.map((r) => Object.values(r).join(","));
  return [headers, ...rows].join("\n");
}

export function exportJSON(recommendations: Recommendation[]): string {
  return JSON.stringify(recommendations, null, 2);
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
