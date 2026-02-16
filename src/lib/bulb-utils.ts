import { supabase } from "@/integrations/supabase/client";

export interface BulbRecord {
  id?: string;
  year: number;
  bulb_type: string;
  easter_date: string;
  removal_date: string | null;
  dbe: number | null;
  ship_date?: string | null;
  avg_temp_from_removal_f?: number | null;
  degree_hours_above_40f?: number | null;
  yield_notes?: string | null;
  yield_quality?: string | null;
  grower_notes?: string | null;
  notes?: string | null;
}

export interface EdgeFunctionResponse {
  targetYear: number;
  easterDate: string;
  bulbType: string;
  nRecords: number;
  medianDBE: number;
  p25DBE: number;
  p75DBE: number;
  iqr: number;
  confidence: "High" | "Medium" | "Low";
  recommendedRemovalDate: string;
  recommendedWindow: { start: string; end: string };
  dbeValues: number[];
  notes: string[];
  error?: string;
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

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function fetchBulbTypes(): Promise<string[]> {
  const { data } = await supabase
    .from("bulb_records")
    .select("bulb_type")
    .not("removal_date", "is", null)
    .order("bulb_type");
  if (!data) return [];
  return [...new Set(data.map((r) => r.bulb_type))];
}

export async function fetchBulbRecordCount(): Promise<number> {
  const { count } = await supabase
    .from("bulb_records")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function clearAndInsertBulbRecords(records: BulbRecord[]) {
  await supabase.from("bulb_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500).map(({ id, ...r }) => r);
    const { error } = await supabase.from("bulb_records").insert(chunk);
    if (error) throw error;
  }
}

export async function clearAllBulbRecords() {
  const { error } = await supabase.from("bulb_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
}

export async function callBulbRecommendations(
  targetYear: number,
  bulbType: string
): Promise<EdgeFunctionResponse> {
  const { data, error } = await supabase.functions.invoke("bulb-recommendations", {
    body: { targetYear, bulbType },
  });
  if (error) throw error;
  return data as EdgeFunctionResponse;
}

export function exportCSV(resp: EdgeFunctionResponse): string {
  const headers = "bulb_type,easter_date,median_dbe,p25_dbe,p75_dbe,iqr,confidence,recommended_removal,window_start,window_end,records_used";
  const row = [
    resp.bulbType, resp.easterDate, resp.medianDBE, resp.p25DBE, resp.p75DBE,
    resp.iqr, resp.confidence, resp.recommendedRemovalDate,
    resp.recommendedWindow.start, resp.recommendedWindow.end, resp.nRecords,
  ].join(",");
  return [headers, row].join("\n");
}

export function exportJSON(resp: EdgeFunctionResponse): string {
  return JSON.stringify(resp, null, 2);
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
