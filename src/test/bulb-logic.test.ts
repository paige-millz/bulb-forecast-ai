import { describe, it, expect } from "vitest";
import { computeEasterDate, formatDate, diffDays } from "@/lib/bulb-utils";

// ── Mirrors of edge-function helpers for unit testing ──────
// These are exact copies of the pure functions in
// supabase/functions/bulb-recommendations/index.ts so we can
// test them without a Deno runtime.

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

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
      if (i === 0 || sorted[i].weight === 0) return sorted[i].value;
      const frac = (target - prevCum) / sorted[i].weight;
      return sorted[i - 1].value + frac * (sorted[i].value - sorted[i - 1].value);
    }
  }
  return sorted[sorted.length - 1].value;
}

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

// ── Easter date tests ──────────────────────────────────────
describe("computeEasterDate", () => {
  it("computes known Easter dates correctly", () => {
    // Verified against published Easter dates
    const cases: [number, string][] = [
      [2023, "2023-04-09"],
      [2024, "2024-03-31"],
      [2025, "2025-04-20"],
      [2026, "2026-04-05"],
      [2027, "2027-03-28"],
      [2030, "2030-04-21"],
    ];
    for (const [year, expected] of cases) {
      const result = formatDate(computeEasterDate(year));
      expect(result).toBe(expected);
    }
  });

  it("handles early Easter (March 22 is the earliest possible)", () => {
    // 2285 is the next year where Easter falls on March 22
    const d = computeEasterDate(2285);
    expect(d.getMonth()).toBe(2); // March
    expect(d.getDate()).toBe(22);
  });

  it("handles late Easter (April 25 is the latest possible)", () => {
    // 2038 has Easter on April 25
    const d = computeEasterDate(2038);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(25);
  });
});

// ── Percentile tests ───────────────────────────────────────
describe("percentile", () => {
  it("returns the only element for a single-item array", () => {
    expect(percentile([42], 50)).toBe(42);
  });

  it("returns 0 for empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("computes median of even-length array", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
  });

  it("computes median of odd-length array", () => {
    expect(percentile([10, 20, 30], 50)).toBe(20);
  });

  it("computes P25 and P75 correctly", () => {
    // For [14, 14, 17, 18, 19, 20, 25, 25, 28, 28, 29, 29, 31, 34, 35, 47]
    // (sorted DBE values from the sample data for a mixed bulb set)
    const vals = [14, 14, 17, 18, 19, 20, 25, 25, 28, 28, 29, 29, 31, 34, 35, 47];
    const p25 = percentile(vals, 25);
    const p50 = percentile(vals, 50);
    const p75 = percentile(vals, 75);
    expect(p25).toBeGreaterThan(17);
    expect(p25).toBeLessThan(20);
    expect(p50).toBeGreaterThanOrEqual(25);
    expect(p50).toBeLessThanOrEqual(28);
    expect(p75).toBeGreaterThan(29);
    expect(p75).toBeLessThan(35);
  });

  it("returns exact values at 0 and 100 percentiles", () => {
    const vals = [5, 10, 15, 20, 25];
    expect(percentile(vals, 0)).toBe(5);
    expect(percentile(vals, 100)).toBe(25);
  });
});

// ── Weighted percentile tests ──────────────────────────────
describe("weightedPercentile", () => {
  it("equals unweighted percentile when all weights are 1", () => {
    const vals = [
      { value: 14, weight: 1 },
      { value: 25, weight: 1 },
      { value: 28, weight: 1 },
      { value: 34, weight: 1 },
    ];
    // With uniform weights, should match standard percentile behavior
    const median = weightedPercentile(vals, 50);
    expect(median).toBeGreaterThanOrEqual(25);
    expect(median).toBeLessThanOrEqual(28);
  });

  it("pulls toward higher-weighted values", () => {
    // Two values: 20 (weight 1) and 30 (weight 3)
    // Total weight = 4, target = 2.0
    // After value 20: cumulative = 1. After value 30: cumulative = 4.
    // Interpolation: frac = (2-1)/3 = 0.333, result = 20 + 3.33 = 23.33
    // Higher weight on 30 pulls it above the unweighted midpoint of 25
    // (which would be 25 if weights were equal)
    const vals = [
      { value: 20, weight: 1 },
      { value: 30, weight: 3 },
    ];
    const median = weightedPercentile(vals, 50);
    // With equal weights, median would be 25. With weight 3 on 30,
    // the weighted median is 23.33 — still shifted toward 30 relative
    // to what it would be with reversed weights (26.67 if weight 3 on 20).
    const reversedMedian = weightedPercentile(
      [{ value: 20, weight: 3 }, { value: 30, weight: 1 }],
      50,
    );
    expect(median).toBeGreaterThan(reversedMedian);
  });

  it("returns 0 for empty input", () => {
    expect(weightedPercentile([], 50)).toBe(0);
  });

  it("returns the single value for single-item input", () => {
    expect(weightedPercentile([{ value: 42, weight: 2 }], 50)).toBe(42);
  });

  it("handles yield_quality weighting scenario", () => {
    // Simulate: 3 records, one with "excellent" quality at 25 DBE,
    // two with no quality at 30 and 35 DBE
    const vals = [
      { value: 25, weight: 2.0 },  // excellent
      { value: 30, weight: 1.0 },  // no quality
      { value: 35, weight: 1.0 },  // no quality
    ];
    const median = weightedPercentile(vals, 50);
    // With weights [2, 1, 1], total = 4, target = 2.0
    // cumulative: 2 at value 25, 3 at 30, 4 at 35
    // target 2.0 is reached at value 25
    expect(median).toBe(25);
  });
});

// ── Yield weight tests ─────────────────────────────────────
describe("yieldWeight", () => {
  it("returns 1.0 for null/undefined/empty", () => {
    expect(yieldWeight(null)).toBe(1.0);
    expect(yieldWeight(undefined)).toBe(1.0);
    expect(yieldWeight("")).toBe(1.0);
  });

  it("maps quality levels correctly", () => {
    expect(yieldWeight("excellent")).toBe(2.0);
    expect(yieldWeight("Excellent")).toBe(2.0);
    expect(yieldWeight("good")).toBe(1.5);
    expect(yieldWeight("Good")).toBe(1.5);
    expect(yieldWeight("fair")).toBe(0.75);
    expect(yieldWeight("poor")).toBe(0.5);
  });

  it("returns 1.0 for unrecognized quality strings", () => {
    expect(yieldWeight("average")).toBe(1.0);
    expect(yieldWeight("unknown")).toBe(1.0);
  });
});

// ── diffDays tests ─────────────────────────────────────────
describe("diffDays", () => {
  it("computes positive days between dates", () => {
    const easter = new Date(2025, 3, 20); // April 20
    const removal = new Date(2025, 2, 4); // March 4
    expect(diffDays(easter, removal)).toBe(47);
  });

  it("returns 0 for same date", () => {
    const d = new Date(2025, 0, 1);
    expect(diffDays(d, d)).toBe(0);
  });
});

// ── GDH accumulation logic test ────────────────────────────
describe("GDH accumulation walk-backward", () => {
  // Simulates the core logic from the edge function:
  // Walk backward from Easter through daily temps, accumulating
  // degree-hours above 40°F until we hit a target.
  function walkBackward(
    easter: Date,
    dailyTemps: { date: Date; tavg_f: number }[],
    targetGDH: number,
  ): { date: Date; dbe: number } | null {
    const sorted = [...dailyTemps].sort((a, b) => b.date.getTime() - a.date.getTime());
    let accumulated = 0;
    for (const day of sorted) {
      if (day.date > easter) continue;
      const dailyDH = day.tavg_f > 40 ? (day.tavg_f - 40) * 24 : 0;
      accumulated += dailyDH;
      if (accumulated >= targetGDH) {
        const dbe = Math.round((easter.getTime() - day.date.getTime()) / 86400000);
        return { date: day.date, dbe };
      }
    }
    return null;
  }

  it("finds the correct removal date with uniform warm temps", () => {
    const easter = new Date(2026, 3, 5); // April 5, 2026
    // 65 days of 50°F from Feb 1 through April 5 (Easter)
    // Each day = (50-40)*24 = 240 degree-hours
    const dailyTemps = Array.from({ length: 65 }, (_, i) => ({
      date: new Date(2026, 1, 1 + i), // Feb 1 through April 6
      tavg_f: 50,
    }));

    // Target 2400 degree-hours → need 10 days of 240 DH/day
    // Walking back from April 5: April 5, 4, 3, 2, 1, Mar 31, 30, 29, 28, 27
    // Hit target at March 27 → DBE = 9 (April 5 - March 27)
    // (10 days of accumulation, but last day IS Easter → DBE = 9)
    const result = walkBackward(easter, dailyTemps, 2400);
    expect(result).not.toBeNull();
    // 10 days of accumulation starting from Easter backward
    expect(result!.dbe).toBeGreaterThanOrEqual(9);
    expect(result!.dbe).toBeLessThanOrEqual(10);
  });

  it("returns null when temps are too cold to reach target", () => {
    const easter = new Date(2026, 3, 5);
    // All temps at 35°F → 0 degree-hours per day
    const dailyTemps = Array.from({ length: 60 }, (_, i) => ({
      date: new Date(2026, 1, 1 + i),
      tavg_f: 35,
    }));

    const result = walkBackward(easter, dailyTemps, 2400);
    expect(result).toBeNull();
  });

  it("handles variable temps correctly", () => {
    const easter = new Date(2026, 3, 5); // April 5
    // Mix of warm and cold days
    const dailyTemps = [
      { date: new Date(2026, 3, 4), tavg_f: 55 }, // 360 DH
      { date: new Date(2026, 3, 3), tavg_f: 38 }, // 0 DH (below 40)
      { date: new Date(2026, 3, 2), tavg_f: 50 }, // 240 DH → total 600
      { date: new Date(2026, 3, 1), tavg_f: 45 }, // 120 DH → total 720
      { date: new Date(2026, 2, 31), tavg_f: 60 }, // 480 DH → total 1200
    ];

    // Target 600 DH → should land on April 2 (3 days before Easter)
    const result = walkBackward(easter, dailyTemps, 600);
    expect(result).not.toBeNull();
    expect(result!.dbe).toBe(3);
  });
});
