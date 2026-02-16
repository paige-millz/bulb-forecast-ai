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

// ── Robust statistics helpers ───────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetYear, bulbType } = await req.json();

    if (!targetYear || !bulbType) {
      return new Response(
        JSON.stringify({ error: "targetYear and bulbType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Easter date
    const easter = computeEaster(targetYear);
    const easterDate = fmt(easter);

    // 2. Load bulb_records filtered by bulbType
    const notes: string[] = [];
    let query = supabase.from("bulb_records").select("*");
    if (bulbType !== "All") {
      query = query.eq("bulb_type", bulbType);
    }
    let { data: records, error: recErr } = await query;
    if (recErr) throw recErr;

    // 3. Fallback if < 4 records
    if (!records || records.length < 4) {
      const label = bulbType !== "All" ? bulbType : "selected filter";
      notes.push(`Insufficient history for "${label}" (${records?.length ?? 0} records). Using full dataset.`);
      const { data: allRecords, error: allErr } = await supabase.from("bulb_records").select("*");
      if (allErr) throw allErr;
      records = allRecords;
    }

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "No bulb records found in the database." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Ensure DBE values exist — filter out records without removal dates
    const dbeValues: number[] = records
      .map((r: any) => {
        if (r.dbe && Number(r.dbe) > 0) return Number(r.dbe);
        if (r.easter_date && r.removal_date) {
          const ed = new Date(r.easter_date);
          const rd = new Date(r.removal_date);
          return Math.round((ed.getTime() - rd.getTime()) / 86400000);
        }
        return null;
      })
      .filter((v): v is number => v != null && v > 0);

    // 5. Compute robust statistics
    const sorted = [...dbeValues].sort((a, b) => a - b);
    const nRecords = sorted.length;
    const medianDBE = percentile(sorted, 50);
    const p25DBE = percentile(sorted, 25);
    const p75DBE = percentile(sorted, 75);
    const iqr = Math.round((p75DBE - p25DBE) * 10) / 10;

    // 6. Recommended timing
    const roundedMedian = Math.round(medianDBE);
    const recommendedDate = addDays(easter, -roundedMedian);
    const windowStart = addDays(easter, -Math.round(p75DBE)); // earlier pull
    const windowEnd = addDays(easter, -Math.round(p25DBE));   // later pull

    // 7. Confidence scoring
    let confidence: "High" | "Medium" | "Low";
    if (nRecords >= 10 && iqr <= 4) {
      confidence = "High";
    } else if (nRecords >= 6 && iqr <= 7) {
      confidence = "Medium";
    } else {
      confidence = "Low";
    }

    // Data quality warnings
    if (nRecords < 6) {
      notes.push("Limited historical data. Results may be less reliable.");
    }
    if (iqr > 8) {
      notes.push("High variability in historical timing. Consider reviewing data quality.");
    }

    // 8. Build response
    const response = {
      targetYear,
      easterDate,
      bulbType,
      nRecords,
      medianDBE: Math.round(medianDBE * 10) / 10,
      p25DBE: Math.round(p25DBE * 10) / 10,
      p75DBE: Math.round(p75DBE * 10) / 10,
      iqr,
      confidence,
      recommendedRemovalDate: fmt(recommendedDate),
      recommendedWindow: {
        start: fmt(windowStart),
        end: fmt(windowEnd),
      },
      dbeValues: sorted,
      notes,
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
