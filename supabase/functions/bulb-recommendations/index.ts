import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Computus (Anonymous Gregorian) ──────────────────────────
function computeEaster(year: number): Date {
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

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (86400000));
}

// ── Simple OLS regression ───────────────────────────────────
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetYear, bulbType, modelType } = await req.json();

    if (!targetYear || !bulbType) {
      return new Response(
        JSON.stringify({ error: "targetYear and bulbType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Easter date ──────────────────────────────────────
    const easter = computeEaster(targetYear);
    const easterDate = fmt(easter);

    // ── 2. Load bulb_records ────────────────────────────────
    let query = supabase.from("bulb_records").select("*");
    if (bulbType !== "All") {
      query = query.eq("bulb_type", bulbType);
    }
    const { data: records, error: recErr } = await query;
    if (recErr) throw recErr;
    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ error: `No bulb records found for type "${bulbType}".` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Compute avgDBE ───────────────────────────────────
    const totalDbe = records.reduce((s: number, r: any) => s + Number(r.dbe), 0);
    const avgDBE = Math.round((totalDbe / records.length) * 10) / 10;

    // ── 4. Build regression model ───────────────────────────
    // Load weather data for all historical dates around Easter ±60 days
    // Build (dbe → tavg) data points by joining records with weather
    const allPoints: { x: number; y: number }[] = [];
    const pointsByYear: Record<number, { x: number; y: number }[]> = {};

    // For each record, get weather around that year's Easter
    const yearGroups: Record<number, any[]> = {};
    for (const r of records) {
      const y = Number(r.year);
      if (!yearGroups[y]) yearGroups[y] = [];
      yearGroups[y].push(r);
    }

    for (const [yearStr, _recs] of Object.entries(yearGroups)) {
      const yr = Number(yearStr);
      const yrEaster = computeEaster(yr);
      const start = addDays(yrEaster, -60);

      const { data: weather } = await supabase
        .from("weather_daily")
        .select("date, tavg_f")
        .gte("date", fmt(start))
        .lte("date", fmt(yrEaster))
        .order("date");

      if (weather && weather.length > 0) {
        for (const w of weather) {
          const dbe = diffDays(yrEaster, new Date(w.date));
          const pt = { x: dbe, y: Number(w.tavg_f) };
          allPoints.push(pt);
          if (!pointsByYear[yr]) pointsByYear[yr] = [];
          pointsByYear[yr].push(pt);
        }
      }
    }

    let slope: number;
    let intercept: number;
    let usedModel = modelType || "overall";
    let fallbackNotice: string | null = null;

    if (usedModel === "by_year" || usedModel === "by-year") {
      const years = Object.keys(pointsByYear).map(Number);
      if (years.length < 2) {
        // Fallback to overall
        usedModel = "overall";
        fallbackNotice = "Too few years with weather data (<2). Fell back to overall model.";
        const reg = linearRegression(allPoints);
        slope = reg.slope;
        intercept = reg.intercept;
      } else {
        // Fit per year, average slopes/intercepts
        let totalSlope = 0, totalIntercept = 0;
        for (const yr of years) {
          const reg = linearRegression(pointsByYear[yr]);
          totalSlope += reg.slope;
          totalIntercept += reg.intercept;
        }
        slope = totalSlope / years.length;
        intercept = totalIntercept / years.length;
      }
    } else {
      const reg = linearRegression(allPoints);
      slope = reg.slope;
      intercept = reg.intercept;
    }

    // ── 5. Generate predicted temp series (60 → 0) ─────────
    const chartSeries: { daysBeforeEaster: number; predictedTavgF: number }[] = [];
    for (let dbe = 60; dbe >= 0; dbe--) {
      chartSeries.push({
        daysBeforeEaster: dbe,
        predictedTavgF: Math.round((slope * dbe + intercept) * 10) / 10,
      });
    }

    // ── 6. Recommended removal date ─────────────────────────
    const roundedDbe = Math.round(avgDBE);
    const recommendedDate = addDays(easter, -roundedDbe);

    // ── 7. Build response ───────────────────────────────────
    const response: any = {
      targetYear,
      easterDate,
      bulbType,
      modelType: usedModel,
      avgDBE,
      recommendedRemovalDate: fmt(recommendedDate),
      recommendedWindow: {
        start: fmt(addDays(recommendedDate, -2)),
        end: fmt(addDays(recommendedDate, 2)),
      },
      recordsUsed: records.length,
      chartSeries,
      smallDatasetWarning: records.length < 10
        ? `Only ${records.length} records used. Results may be unreliable.`
        : null,
      fallbackNotice,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
