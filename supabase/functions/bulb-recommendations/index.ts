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

// Weighted percentile: each value has a weight. Higher-weight records
// pull the result toward themselves. Used to let yield_quality influence
// the recommendation — good outcomes count more.
function weightedPercentile(
  values: { value: number; weight: number }[],
  p: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((s, v) => s + v.weight, 0);
  if (totalWeight === 0) return 0;

  const target = (p / 100) * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prevCum = cumulative;
    cumulative += sorted[i].weight;
    if (cumulative >= target) {
      // Linear interpolation within this step
      if (i === 0 || sorted[i].weight === 0) return sorted[i].value;
      const frac = (target - prevCum) / sorted[i].weight;
      return sorted[i - 1].value + frac * (sorted[i].value - sorted[i - 1].value);
    }
  }
  return sorted[sorted.length - 1].value;
}

// Map yield_quality text to a numeric weight.
// Good outcomes pull the recommendation toward timings that worked.
function yieldWeight(quality: string | null | undefined): number {
  if (!quality) return 1.0;
  switch (quality.toLowerCase().trim()) {
    case "excellent": return 2.0;
    case "good":      return 1.5;
    case "fair":      return 0.75;
    case "poor":      return 0.5;
    default:          return 1.0;
  }
}

// Compute DBE from a record, preferring the stored value.
function extractDBE(rec: any): number | null {
  if (rec.dbe && Number(rec.dbe) > 0) return Number(rec.dbe);
  if (rec.easter_date && rec.removal_date) {
    const ed = new Date(rec.easter_date);
    const rd = new Date(rec.removal_date);
    const diff = Math.round((ed.getTime() - rd.getTime()) / 86400000);
    return diff > 0 ? diff : null;
  }
  return null;
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

    // 1. Easter date for the target year
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

    // 3. Fallback if < 2 records for the selected type
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

    // 4. Extract enriched data from each record:
    //    - DBE (days before Easter)
    //    - degree_hours (from the pre-calculated field if available)
    //    - yield weight (from yield_quality)
    interface EnrichedRecord {
      dbe: number;
      degreeHours: number | null;
      weight: number;
      year: number;
      removalDate: string | null;
      easterDate: string | null;
    }
    const enriched: EnrichedRecord[] = [];
    for (const rec of records) {
      const dbe = extractDBE(rec);
      if (dbe == null) continue;
      enriched.push({
        dbe,
        degreeHours: rec.degree_hours_above_40f != null ? Number(rec.degree_hours_above_40f) : null,
        weight: yieldWeight(rec.yield_quality),
        year: rec.year,
        removalDate: rec.removal_date,
        easterDate: rec.easter_date,
      });
    }

    // Raw sorted DBE values (unweighted, for the histogram)
    const sorted = enriched.map((r) => r.dbe).sort((a, b) => a - b);
    const nRecords = sorted.length;

    // 5. Compute weighted robust statistics
    //    When yield_quality data exists, good outcomes pull the median toward
    //    their timing. When no quality data exists, all weights are 1.0 and
    //    this reduces to a standard percentile.
    const weightedValues = enriched.map((r) => ({ value: r.dbe, weight: r.weight }));
    const medianDBE = weightedPercentile(weightedValues, 50);
    const p25DBE = weightedPercentile(weightedValues, 25);
    const p75DBE = weightedPercentile(weightedValues, 75);
    const iqr = Math.round((p75DBE - p25DBE) * 10) / 10;

    // 6. Recommended timing from weighted median
    const roundedMedian = Math.round(medianDBE);
    const recommendedDate = addDays(easter, -roundedMedian);
    const windowStart = addDays(easter, -Math.round(p75DBE)); // earlier pull
    const windowEnd = addDays(easter, -Math.round(p25DBE));   // later pull

    // 7. Confidence scoring
    let confidence: "High" | "Medium" | "Low";
    if (nRecords >= 3 && iqr <= 5) {
      confidence = "High";
    } else if (nRecords >= 2 && iqr <= 8) {
      confidence = "Medium";
    } else {
      confidence = "Low";
    }

    if (nRecords < 3) {
      notes.push("Limited historical data. Results may be less reliable.");
    }
    if (iqr > 8) {
      notes.push("High variability in historical timing. Consider reviewing data quality.");
    }

    // Flag if yield_quality weighting is active
    const hasQualityData = enriched.some((r) => r.weight !== 1.0);
    if (hasQualityData) {
      notes.push("Yield quality weighting active — recommendations favor timings that produced better outcomes.");
    }

    // ── 8. Weather-informed adjustment ───────────────────────────
    //
    // Two complementary models:
    //
    //   A) GDH Accumulation Model (preferred)
    //      Uses the actual degree-hours each historical record accumulated
    //      (from the pre-calculated field or weather_daily). Computes a
    //      target GDH, then walks backward from Easter using current-year
    //      weather to find the date that accumulates that target.
    //
    //   B) Temperature Regression (fallback)
    //      Linear regression of avg-temp vs DBE, with tighter thresholds
    //      than before (n >= 4, |r| >= 0.4).
    //
    //   GDH is preferred because it directly models the physiological
    //   mechanism (heat accumulation drives bulb development). Regression
    //   is a fallback when GDH data is insufficient.
    //
    // Both use Easter-relative windowing instead of day-of-year, which
    // correctly handles Easter shifting by up to 35 days across years.
    // ─────────────────────────────────────────────────────────────

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

        // ── 8a. Pair historical records with degree-hours ────────
        // Prefer the pre-calculated degree_hours_above_40f from the record.
        // Fall back to computing from weather_daily for that record's window.
        const recordsWithGDH: { dbe: number; degreeHours: number; avgTemp: number; year: number; weight: number }[] = [];

        for (const rec of enriched) {
          if (!rec.removalDate || !rec.easterDate) continue;

          let dh = rec.degreeHours;
          let avgTemp: number | null = null;

          // Try weather_daily for this record's actual window
          const removalDate = new Date(rec.removalDate);
          const easterDateRec = new Date(rec.easterDate);
          const windowDays = weatherData.filter((w) => {
            const wd = new Date(w.date);
            return wd >= removalDate && wd <= easterDateRec;
          });

          if (windowDays.length >= 5) {
            avgTemp = windowDays.reduce((s, d) => s + Number(d.tavg_f), 0) / windowDays.length;
            // If record didn't have pre-calculated degree_hours, compute from weather
            if (dh == null || dh === 0) {
              dh = windowDays.reduce((s, d) => {
                const t = Number(d.tavg_f);
                return s + (t > 40 ? (t - 40) * 24 : 0);
              }, 0);
            }
          }

          if (dh != null && avgTemp != null) {
            recordsWithGDH.push({
              dbe: rec.dbe,
              degreeHours: Math.round(dh),
              avgTemp: Math.round(avgTemp * 10) / 10,
              year: rec.year,
              weight: rec.weight,
            });
          }
        }

        // ── 8b. Easter-relative year-level weather stats ─────────
        // For each year in weather_daily, compute stats for the window
        // that is [roundedMedian days before that year's Easter] to
        // [that year's Easter]. This correctly handles Easter shifting.
        const yearStats: { year: number; avgTemp: number; degreeHours: number; days: number }[] = [];
        const yearsInWeather = [...new Set(weatherData.map((w) => new Date(w.date).getFullYear()))];

        for (const yr of yearsInWeather) {
          const yrEaster = computeEaster(yr);
          const yrWindowStart = addDays(yrEaster, -roundedMedian);
          const days = weatherData.filter((w) => {
            const wd = new Date(w.date);
            return wd >= yrWindowStart && wd <= yrEaster;
          });
          if (days.length < 5) continue;
          const avg = days.reduce((s, d) => s + Number(d.tavg_f), 0) / days.length;
          const dh = days.reduce((s, d) => {
            const t = Number(d.tavg_f);
            return s + (t > 40 ? (t - 40) * 24 : 0);
          }, 0);
          yearStats.push({
            year: yr,
            avgTemp: Math.round(avg * 10) / 10,
            degreeHours: Math.round(dh),
            days: days.length,
          });
        }

        const overallAvgTemp = yearStats.length > 0
          ? Math.round((yearStats.reduce((s, y) => s + y.avgTemp, 0) / yearStats.length) * 10) / 10
          : null;
        const overallAvgDegreeHours = yearStats.length > 0
          ? Math.round(yearStats.reduce((s, y) => s + y.degreeHours, 0) / yearStats.length)
          : null;
        const currentYearStats = yearStats.find((y) => y.year === targetYear) || null;

        weatherContext = {
          historicalAvgTemp: overallAvgTemp,
          historicalAvgDegreeHours: overallAvgDegreeHours,
          yearsWithData: yearStats.length,
          yearStats,
          currentYear: currentYearStats,
          correlation: null as any,
          gdhModel: null as any,
        };

        // ── 8c. GDH Accumulation Model ──────────────────────────
        // Historical records tell us how many degree-hours the bulbs
        // actually accumulated. We compute a target GDH (weighted median
        // of records with degree_hours > 0). Then, using weather_daily
        // for the target year, walk backward from Easter accumulating
        // daily degree-hours until we hit the target.
        const gdhRecords = recordsWithGDH.filter((r) => r.degreeHours > 0);
        let gdhModel: any = null;

        if (gdhRecords.length >= 2) {
          const gdhWeighted = gdhRecords.map((r) => ({
            value: r.degreeHours,
            weight: r.weight,
          }));
          const targetGDH = weightedPercentile(gdhWeighted, 50);
          const medianGDH = percentile(
            gdhRecords.map((r) => r.degreeHours).sort((a, b) => a - b),
            50,
          );

          gdhModel = { targetGDH: Math.round(targetGDH), medianGDH: Math.round(medianGDH), projectedRemovalDate: null as string | null, projectedDBE: null as number | null };

          // Walk backward from Easter using target year's weather
          if (currentYearStats) {
            // Get daily weather for the target year, sorted descending from Easter
            const targetYearDays = weatherData
              .filter((w) => {
                const wd = new Date(w.date);
                return wd.getFullYear() === targetYear && wd <= easter;
              })
              .map((w) => ({ date: new Date(w.date), tavg_f: Number(w.tavg_f) }))
              .sort((a, b) => b.date.getTime() - a.date.getTime());

            if (targetYearDays.length >= 5) {
              let accumulated = 0;
              let projectedDate: Date | null = null;

              for (const day of targetYearDays) {
                const dailyDH = day.tavg_f > 40 ? (day.tavg_f - 40) * 24 : 0;
                accumulated += dailyDH;
                if (accumulated >= targetGDH) {
                  projectedDate = day.date;
                  break;
                }
              }

              if (projectedDate) {
                const projectedDBE = Math.round((easter.getTime() - projectedDate.getTime()) / 86400000);
                if (projectedDBE > 0 && projectedDBE < 60) {
                  gdhModel.projectedRemovalDate = fmt(projectedDate);
                  gdhModel.projectedDBE = projectedDBE;

                  // Use GDH model as the primary weather adjustment
                  weatherAdjustedDBE = projectedDBE;
                  weatherAdjustedDate = projectedDate;
                  const halfIQR = Math.round(iqr / 2) || 1;
                  weatherAdjustedWindow = {
                    start: addDays(easter, -(projectedDBE + halfIQR)),
                    end: addDays(easter, -(projectedDBE - halfIQR)),
                  };

                  const diff = projectedDBE - roundedMedian;
                  if (Math.abs(diff) >= 1) {
                    const direction = diff > 0 ? "earlier" : "later";
                    notes.push(
                      `GDH model: ${targetYear} temps suggest removing ${Math.abs(diff)} day(s) ${direction} than the historical median. Target: ${Math.round(targetGDH)} degree-hours >40°F (based on ${gdhRecords.length} records).`
                    );
                  } else {
                    notes.push(`GDH model: ${targetYear} heat accumulation aligns with historical patterns — no adjustment needed.`);
                  }
                }
              } else {
                // Couldn't reach target GDH — temps too cold for outdoor accumulation
                notes.push(
                  `GDH model: Available ${targetYear} weather doesn't reach the target ${Math.round(targetGDH)} degree-hours >40°F. Greenhouse supplementation likely needed. Using historical DBE median.`
                );
              }
            }
          }

          weatherContext.gdhModel = gdhModel;
        }

        // ── 8d. Temperature Regression (fallback) ───────────────
        // Only used if GDH model didn't produce an adjustment.
        // Tighter thresholds: n >= 4, |r| >= 0.4
        if (recordsWithGDH.length >= 4) {
          const n = recordsWithGDH.length;
          const meanTemp = recordsWithGDH.reduce((s, r) => s + r.avgTemp, 0) / n;
          const meanDBE = recordsWithGDH.reduce((s, r) => s + r.dbe, 0) / n;
          let sumXY = 0, sumX2 = 0, sumY2 = 0;
          for (const r of recordsWithGDH) {
            const dx = r.avgTemp - meanTemp;
            const dy = r.dbe - meanDBE;
            sumXY += dx * dy;
            sumX2 += dx * dx;
            sumY2 += dy * dy;
          }
          const r = sumX2 > 0 && sumY2 > 0 ? sumXY / Math.sqrt(sumX2 * sumY2) : 0;
          const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
          const intercept = meanDBE - slope * meanTemp;

          weatherContext.correlation = {
            r: Math.round(r * 1000) / 1000,
            slope: Math.round(slope * 100) / 100,
            intercept: Math.round(intercept * 10) / 10,
            nPaired: n,
            pairedData: recordsWithGDH,
          };

          // Only use regression if GDH model didn't already produce a result
          if (weatherAdjustedDBE == null && currentYearStats && Math.abs(r) >= 0.4) {
            const predictedDBE = Math.round(slope * currentYearStats.avgTemp + intercept);
            if (predictedDBE > 0 && predictedDBE < 60) {
              weatherAdjustedDBE = predictedDBE;
              weatherAdjustedDate = addDays(easter, -predictedDBE);
              const halfIQR = Math.round(iqr / 2) || 1;
              weatherAdjustedWindow = {
                start: addDays(easter, -(predictedDBE + halfIQR)),
                end: addDays(easter, -(predictedDBE - halfIQR)),
              };
              const diff = predictedDBE - roundedMedian;
              if (Math.abs(diff) >= 1) {
                const direction = diff > 0 ? "earlier" : "later";
                notes.push(
                  `Weather regression: Based on ${currentYearStats.avgTemp}°F avg temp (historical avg: ${overallAvgTemp}°F), suggests removing ${Math.abs(diff)} day(s) ${direction} (r=${Math.round(r * 100) / 100}, ${n} paired records).`
                );
              } else {
                notes.push(`Current year temps align with historical averages — no weather adjustment needed.`);
              }
            }
          } else if (weatherAdjustedDBE == null && !currentYearStats) {
            notes.push(`No weather data for ${targetYear} yet. With weather data, the model can fine-tune the recommendation (${n} paired records available, r=${Math.round(r * 100) / 100}).`);
          } else if (weatherAdjustedDBE == null && Math.abs(r) < 0.4) {
            notes.push(`Weather correlation too weak to adjust (r=${Math.round(r * 100) / 100}, need |r| >= 0.4). Using historical DBE median.`);
          }
        } else if (weatherAdjustedDBE == null) {
          // Not enough paired data for either model
          if (recordsWithGDH.length > 0) {
            notes.push(`Only ${recordsWithGDH.length} year(s) have paired weather+DBE data. Need more history for weather-adjusted predictions.`);
          } else if (yearStats.length > 0) {
            notes.push("Weather data exists but doesn't overlap with bulb record dates. Upload matching years for weather-adjusted insights.");
          } else {
            notes.push("No weather data synced yet. Upload or sync weather data for temperature-adjusted insights.");
          }
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
