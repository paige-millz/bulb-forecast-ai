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

    // 3. Fallback if < 2 records
    if (!records || records.length < 2) {
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

    // 7. Confidence scoring — relaxed thresholds for small datasets
    let confidence: "High" | "Medium" | "Low";
    if (nRecords >= 3 && iqr <= 5) {
      confidence = "High";
    } else if (nRecords >= 2 && iqr <= 8) {
      confidence = "Medium";
    } else {
      confidence = "Low";
    }

    // Data quality warnings
    if (nRecords < 3) {
      notes.push("Limited historical data. Results may be less reliable.");
    }
    if (iqr > 8) {
      notes.push("High variability in historical timing. Consider reviewing data quality.");
    }

    // 8. Weather-informed adjustment
    //    Correlate historical weather with actual DBE to adjust the recommendation
    let weatherContext: any = null;
    let weatherAdjustedDBE: number | null = null;
    let weatherAdjustedDate: Date | null = null;
    let weatherAdjustedWindow: { start: Date; end: Date } | null = null;

    try {
      const { data: weatherData, error: weatherErr } = await supabase
        .from("weather_daily")
        .select("date, tavg_f, tmax_f, tmin_f")
        .order("date", { ascending: true });

      if (!weatherErr && weatherData && weatherData.length > 0) {
        // For each historical record that has a valid DBE AND removal_date,
        // calculate the avg temp during its actual removal-to-Easter window
        const recordsWithWeather: { dbe: number; avgTemp: number; degreeHours: number; year: number }[] = [];

        for (const rec of records!) {
          const recDBE = rec.dbe && Number(rec.dbe) > 0
            ? Number(rec.dbe)
            : rec.easter_date && rec.removal_date
              ? Math.round((new Date(rec.easter_date).getTime() - new Date(rec.removal_date).getTime()) / 86400000)
              : null;
          if (!recDBE || recDBE <= 0 || !rec.removal_date || !rec.easter_date) continue;

          const removalDate = new Date(rec.removal_date);
          const easterDateRec = new Date(rec.easter_date);

          // Find weather data for this record's actual removal-to-Easter window
          const windowDays = weatherData.filter((w) => {
            const wd = new Date(w.date);
            return wd >= removalDate && wd <= easterDateRec;
          });

          if (windowDays.length >= 5) { // need at least 5 days of weather data
            const avgTemp = windowDays.reduce((s, d) => s + Number(d.tavg_f), 0) / windowDays.length;
            const degreeHours = windowDays.reduce((s, d) => {
              const t = Number(d.tavg_f);
              return s + (t > 40 ? (t - 40) * 24 : 0);
            }, 0);
            recordsWithWeather.push({
              dbe: recDBE,
              avgTemp: Math.round(avgTemp * 10) / 10,
              degreeHours: Math.round(degreeHours),
              year: rec.year,
            });
          }
        }

        // Build year-level stats for the recommended window (DOY-based)
        const removalDOY = getDayOfYear(recommendedDate);
        const easterDOY = getDayOfYear(easter);
        const yearGroups: Record<number, { tavg_f: number; date: string }[]> = {};
        for (const w of weatherData) {
          const wDate = new Date(w.date);
          const wYear = wDate.getFullYear();
          const wDOY = getDayOfYear(wDate);
          if (wDOY >= removalDOY && wDOY <= easterDOY) {
            if (!yearGroups[wYear]) yearGroups[wYear] = [];
            yearGroups[wYear].push({ tavg_f: Number(w.tavg_f), date: w.date });
          }
        }

        const yearKeys = Object.keys(yearGroups).map(Number);
        const yearStats = yearKeys.map((yr) => {
          const days = yearGroups[yr];
          const avgTemp = days.reduce((s, d) => s + d.tavg_f, 0) / days.length;
          const degreeHours = days.reduce((s, d) => s + (d.tavg_f > 40 ? (d.tavg_f - 40) * 24 : 0), 0);
          return { year: yr, avgTemp: Math.round(avgTemp * 10) / 10, degreeHours: Math.round(degreeHours), days: days.length };
        });

        const overallAvgTemp = yearStats.length > 0 ? yearStats.reduce((s, y) => s + y.avgTemp, 0) / yearStats.length : null;
        const overallAvgDegreeHours = yearStats.length > 0 ? yearStats.reduce((s, y) => s + y.degreeHours, 0) / yearStats.length : null;
        const currentYearStats = yearStats.find((y) => y.year === targetYear);

        weatherContext = {
          historicalAvgTemp: overallAvgTemp ? Math.round(overallAvgTemp * 10) / 10 : null,
          historicalAvgDegreeHours: overallAvgDegreeHours ? Math.round(overallAvgDegreeHours) : null,
          yearsWithData: yearKeys.length,
          yearStats,
          currentYear: currentYearStats || null,
          correlation: null as any,
        };

        // Compute correlation between avg temp and DBE from paired historical data
        if (recordsWithWeather.length >= 3) {
          const n = recordsWithWeather.length;
          const meanTemp = recordsWithWeather.reduce((s, r) => s + r.avgTemp, 0) / n;
          const meanDBE = recordsWithWeather.reduce((s, r) => s + r.dbe, 0) / n;
          let sumXY = 0, sumX2 = 0, sumY2 = 0;
          for (const r of recordsWithWeather) {
            const dx = r.avgTemp - meanTemp;
            const dy = r.dbe - meanDBE;
            sumXY += dx * dy;
            sumX2 += dx * dx;
            sumY2 += dy * dy;
          }
          const r = sumX2 > 0 && sumY2 > 0 ? sumXY / Math.sqrt(sumX2 * sumY2) : 0;
          const slope = sumX2 > 0 ? sumXY / sumX2 : 0; // days per °F
          const intercept = meanDBE - slope * meanTemp;

          weatherContext.correlation = {
            r: Math.round(r * 1000) / 1000,
            slope: Math.round(slope * 100) / 100,
            intercept: Math.round(intercept * 10) / 10,
            nPaired: n,
            pairedData: recordsWithWeather,
          };

          // If current year weather is available, use regression to adjust
          if (currentYearStats && Math.abs(r) >= 0.3) {
            const predictedDBE = Math.round(slope * currentYearStats.avgTemp + intercept);
            if (predictedDBE > 0 && predictedDBE < 60) { // sanity bounds
              weatherAdjustedDBE = predictedDBE;
              weatherAdjustedDate = addDays(easter, -predictedDBE);
              // Adjusted window: ±IQR/2 around the adjusted date
              const halfIQR = Math.round(iqr / 2) || 1;
              weatherAdjustedWindow = {
                start: addDays(easter, -(predictedDBE + halfIQR)),
                end: addDays(easter, -(predictedDBE - halfIQR)),
              };
              const diff = predictedDBE - roundedMedian;
              if (Math.abs(diff) >= 1) {
                const direction = diff > 0 ? "earlier" : "later";
                notes.push(
                  `Weather-adjusted: Based on ${currentYearStats.avgTemp}°F avg temp this year (historical avg: ${Math.round(overallAvgTemp! * 10) / 10}°F), the model suggests removing ${Math.abs(diff)} day(s) ${direction} than the historical median (correlation r=${Math.round(r * 100) / 100}, ${n} paired records).`
                );
              } else {
                notes.push(`Current year temps align with historical averages — no weather adjustment needed.`);
              }
            }
          } else if (!currentYearStats) {
            notes.push(`No weather data for ${targetYear} yet. With weather data, the model can adjust the recommendation by ~${Math.round(Math.abs(slope) * 10) / 10} day(s) per °F difference (based on ${n} paired records, r=${Math.round(r * 100) / 100}).`);
          } else {
            notes.push(`Weather correlation too weak to adjust (r=${Math.round(r * 100) / 100}). Using historical DBE median.`);
          }
        } else if (recordsWithWeather.length > 0) {
          notes.push(`Only ${recordsWithWeather.length} year(s) have paired weather+DBE data. Need ≥3 for weather-adjusted predictions.`);
        } else if (yearKeys.length > 0) {
          notes.push("Weather data exists but doesn't overlap with bulb record dates. Upload matching years for weather-adjusted insights.");
        } else {
          notes.push("No weather data synced yet. Upload or sync weather data for temperature-adjusted insights.");
        }
      } else if (!weatherErr && (!weatherData || weatherData.length === 0)) {
        notes.push("No weather data synced yet. Upload or sync weather data for temperature-adjusted insights.");
      }
    } catch (_weatherError) {
      notes.push("Could not load weather data. Recommendations based on historical DBE only.");
    }

    // 9. Use weather-adjusted values if available, otherwise fallback to median
    const finalDBE = weatherAdjustedDBE ?? roundedMedian;
    const finalDate = weatherAdjustedDate ?? recommendedDate;
    const finalWindowStart = weatherAdjustedWindow?.start ?? windowStart;
    const finalWindowEnd = weatherAdjustedWindow?.end ?? windowEnd;

    // 10. Build response
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
      recommendedRemovalDate: fmt(finalDate),
      recommendedWindow: {
        start: fmt(finalWindowStart),
        end: fmt(finalWindowEnd),
      },
      weatherAdjusted: weatherAdjustedDBE !== null,
      weatherAdjustedDBE: weatherAdjustedDBE,
      baselineDBE: roundedMedian,
      dbeValues: sorted,
      notes,
      weatherContext,
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

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}
