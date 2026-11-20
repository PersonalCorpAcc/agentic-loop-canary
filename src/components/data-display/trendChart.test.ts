import { describe, expect, it } from "vitest";

import {
  categoricalSeriesColors,
  formatCount,
  formatDuration,
  formatPercent,
  isEmptyTrend,
  otherSeriesColor,
  scalarSeriesOf,
  seriesByKeyOf,
} from "./trendChart.js";
import type { DailyTrendPoint } from "../../shared/trends.js";

function point(partial: Partial<DailyTrendPoint> & { readonly day: string }): DailyTrendPoint {
  return {
    totalRuns: 0,
    runsByRoute: {},
    outcomeMix: { acted: 0, "no-action": 0, "handed-to-human": 0, failed: 0, unknown: 0 },
    successRate: undefined,
    medianDurationByRoute: {},
    shareNeedingAttention: 0,
    ...partial,
  };
}

describe("seriesByKeyOf", () => {
  it("gives a key points only for the days it actually appears on, never a zero-padded point", () => {
    const points = [
      point({ day: "2026-03-05", runsByRoute: { "merge-gate": 2, implement: 1 } }),
      point({ day: "2026-03-06", runsByRoute: { implement: 3 } }),
      point({ day: "2026-03-07", runsByRoute: { "merge-gate": 1 } }),
    ];

    const series = seriesByKeyOf(points, (p) => p.runsByRoute);

    const mergeGate = series.find((one) => one.key === "merge-gate");
    expect(mergeGate?.points).toEqual([
      { day: "2026-03-05", value: 2 },
      { day: "2026-03-07", value: 1 },
    ]);
    const implement = series.find((one) => one.key === "implement");
    expect(implement?.points).toEqual([
      { day: "2026-03-05", value: 1 },
      { day: "2026-03-06", value: 3 },
    ]);
  });

  it("produces no series at all for a route with zero runs across the whole period", () => {
    const points = [point({ day: "2026-03-05", runsByRoute: { implement: 1 } })];
    const series = seriesByKeyOf(points, (p) => p.runsByRoute);
    expect(series.find((one) => one.key === "promote")).toBeUndefined();
  });

  it("assigns the categorical colors in first-appearance order and folds a fifth key to the shared color", () => {
    const points = [
      point({
        day: "2026-03-05",
        runsByRoute: { a: 1, b: 1, c: 1, d: 1, e: 1 },
      }),
    ];
    const series = seriesByKeyOf(points, (p) => p.runsByRoute);
    expect(series.map((one) => one.color)).toEqual([...categoricalSeriesColors, otherSeriesColor]);
  });
});

describe("scalarSeriesOf", () => {
  it("skips a day the accessor reports as undefined rather than plotting zero", () => {
    const points = [
      point({ day: "2026-03-05", successRate: 0.8 }),
      point({ day: "2026-03-06", successRate: undefined }),
      point({ day: "2026-03-07", successRate: 1 }),
    ];
    const series = scalarSeriesOf(points, (p) => p.successRate, "success rate", "#2a78d6");
    expect(series.points).toEqual([
      { day: "2026-03-05", value: 0.8 },
      { day: "2026-03-07", value: 1 },
    ]);
  });
});

describe("isEmptyTrend", () => {
  it("is true for no series", () => {
    expect(isEmptyTrend([])).toBe(true);
  });

  it("is true when every series has no points", () => {
    expect(isEmptyTrend([{ key: "implement", color: "#2a78d6", points: [] }])).toBe(true);
  });

  it("is false when at least one series has a point", () => {
    const series = [
      { key: "implement", color: "#2a78d6", points: [{ day: "2026-03-05", value: 1 }] },
    ];
    expect(isEmptyTrend(series)).toBe(false);
  });
});

describe("value formatters", () => {
  it("formats a count as a plain rounded integer", () => {
    expect(formatCount(4)).toBe("4");
    expect(formatCount(4.6)).toBe("5");
  });

  it("formats a share as a whole-number percentage", () => {
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatPercent(0.8)).toBe("80%");
  });

  it("formats a duration in seconds below a minute and minutes at or above it", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(4 * 60_000)).toBe("4m");
    expect(formatDuration(90_000)).toBe("2m");
  });
});
