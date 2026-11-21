import { describe, expect, it } from "vitest";

import { outcomeMixKeys, type DailyTrendPoint } from "../shared/trends.js";
import {
  formatDurationMs,
  formatPercent,
  medianDurationByRouteSeriesOf,
  outcomeMixSeriesOf,
  runsByRouteSeriesOf,
  shareNeedingAttentionSeriesOf,
  successRateSeriesOf,
} from "./loopTrends.js";

function point(day: string, overrides: Partial<DailyTrendPoint> = {}): DailyTrendPoint {
  return {
    day,
    totalRuns: 0,
    runsByRoute: {},
    outcomeMix: Object.fromEntries(outcomeMixKeys.map((key) => [key, 0])) as DailyTrendPoint["outcomeMix"],
    successRate: undefined,
    medianDurationByRoute: {},
    shareNeedingAttention: 0,
    ...overrides,
  };
}

describe("successRateSeriesOf", () => {
  it("10 runs, 2 failed -> 80%", () => {
    const points = [point("2026-01-01", { successRate: 8 / 10 })];
    const [entry] = successRateSeriesOf(points);
    expect(formatPercent(entry!.value)).toBe("80%");
  });

  it("omits a day with no known-outcome run rather than showing 0%", () => {
    const points = [point("2026-01-01", { successRate: undefined }), point("2026-01-02", { successRate: 1 })];
    expect(successRateSeriesOf(points)).toEqual([{ date: "2026-01-02", value: 1 }]);
  });
});

describe("shareNeedingAttentionSeriesOf", () => {
  it("12 runs, 3 needing a person -> 25%", () => {
    const points = [point("2026-01-01", { totalRuns: 12, shareNeedingAttention: 3 / 12 })];
    const [entry] = shareNeedingAttentionSeriesOf(points);
    expect(formatPercent(entry!.value)).toBe("25%");
  });
});

describe("medianDurationByRouteSeriesOf", () => {
  it("merge-gate at 2m/4m/6m keeps a point only on the days it ran, median durations exact", () => {
    const points = [
      point("2026-01-01", { medianDurationByRoute: { "merge-gate": 2 * 60_000 } }),
      // An absent-route day: merge-gate did not run, some other route did.
      point("2026-01-02", { medianDurationByRoute: { lint: 60_000 } }),
      point("2026-01-03", { medianDurationByRoute: { "merge-gate": 4 * 60_000 } }),
      point("2026-01-04", { medianDurationByRoute: { "merge-gate": 6 * 60_000 } }),
    ];
    const series = medianDurationByRouteSeriesOf(points);
    const mergeGate = series.find((s) => s.key === "merge-gate")!;
    expect(mergeGate.points.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-03", "2026-01-04"]);
    expect(mergeGate.points.map((p) => formatDurationMs(p.value))).toEqual(["2m", "4m", "6m"]);
  });
});

describe("runsByRouteSeriesOf", () => {
  it("never gives a route a point on a day it is absent from runsByRoute", () => {
    const points = [
      point("2026-01-01", { runsByRoute: { implement: 2 } }),
      point("2026-01-02", { runsByRoute: {} }),
    ];
    const series = runsByRouteSeriesOf(points);
    const implement = series.find((s) => s.key === "implement")!;
    expect(implement.points).toEqual([{ date: "2026-01-01", value: 2 }]);
  });
});

describe("outcomeMixSeriesOf", () => {
  it("is broken down into exactly the known outcomes plus unknown, never a separate declined", () => {
    const points = [point("2026-01-01")];
    const series = outcomeMixSeriesOf(points);
    expect(series.map((s) => s.key)).toEqual(["acted", "no-action", "handed-to-human", "failed", "unknown"]);
    expect(series.map((s) => s.key)).not.toContain("declined");
  });

  it("keeps a point every day for every key, including a true 0 count", () => {
    const points = [point("2026-01-01", { outcomeMix: { ...point("x").outcomeMix, failed: 0 } })];
    const failed = outcomeMixSeriesOf(points).find((s) => s.key === "failed")!;
    expect(failed.points).toEqual([{ date: "2026-01-01", value: 0 }]);
  });
});

describe("formatDurationMs", () => {
  it("renders sub-minute durations in seconds", () => {
    expect(formatDurationMs(45_000)).toBe("45s");
  });

  it("renders sub-hour durations in whole minutes", () => {
    expect(formatDurationMs(4 * 60_000)).toBe("4m");
  });

  it("renders hour-plus durations with one decimal", () => {
    expect(formatDurationMs(150 * 60_000)).toBe("2.5h");
  });
});
