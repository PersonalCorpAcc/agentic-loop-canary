import { describe, expect, it } from "vitest";

import { layoutOf, mergedDomainOf, pickTickIndices, type TrendSeries } from "./trendChart";

const CATEGORICAL = ["#e69f00", "#56b4e9", "#009e73"];
const OTHER = "#64748b";
const OPTIONS = { width: 400, height: 136 };

function series(key: string, label: string, points: readonly { date: string; value: number }[]): TrendSeries {
  return { key, label, points };
}

describe("mergedDomainOf", () => {
  it("is every distinct date across all series, ascending", () => {
    const a = series("a", "A", [{ date: "2026-01-02", value: 1 }]);
    const b = series("b", "B", [
      { date: "2026-01-01", value: 2 },
      { date: "2026-01-03", value: 3 },
    ]);
    expect(mergedDomainOf([a, b])).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });
});

describe("pickTickIndices", () => {
  it("returns every index when there are fewer than the cap", () => {
    expect(pickTickIndices(3, 5)).toEqual([0, 1, 2]);
  });

  it("caps at count, always including the first and last index", () => {
    const indices = pickTickIndices(30, 5);
    expect(indices.length).toBeLessThanOrEqual(5);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(29);
  });

  it("is empty for zero points", () => {
    expect(pickTickIndices(0, 5)).toEqual([]);
  });
});

describe("layoutOf: empty state", () => {
  it("is isEmpty when every series has zero points", () => {
    const layout = layoutOf([series("a", "A", []), series("b", "B", [])], CATEGORICAL, OTHER, OPTIONS);
    expect(layout.isEmpty).toBe(true);
    expect(layout.series).toEqual([]);
    expect(layout.legend).toEqual([]);
  });

  it("is isEmpty when no series are given at all", () => {
    expect(layoutOf([], CATEGORICAL, OTHER, OPTIONS).isEmpty).toBe(true);
  });
});

describe("layoutOf: legend", () => {
  it("never gives a legend entry to a route absent from every day", () => {
    const present = series("merge-gate", "merge-gate", [{ date: "2026-01-01", value: 4 }]);
    const absent = series("ghost-route", "ghost-route", []);
    const layout = layoutOf([present, absent], CATEGORICAL, OTHER, OPTIONS);
    expect(layout.legend.map((entry) => entry.key)).toEqual(["merge-gate"]);
  });

  it("keeps exactly one legend entry for a route present only on some days", () => {
    const sparse = series("merge-gate", "merge-gate", [
      { date: "2026-01-01", value: 4 },
      { date: "2026-01-03", value: 6 },
    ]);
    const everyDay = series("lint", "lint", [
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-02", value: 1 },
      { date: "2026-01-03", value: 1 },
    ]);
    const layout = layoutOf([sparse, everyDay], CATEGORICAL, OTHER, OPTIONS);
    expect(layout.legend).toHaveLength(2);
    expect(layout.legend.filter((entry) => entry.key === "merge-gate")).toHaveLength(1);
  });
});

describe("layoutOf: gap-aware segments", () => {
  it("never bridges a route's gap day with an interpolated line", () => {
    const sparse = series("merge-gate", "merge-gate", [
      { date: "2026-01-01", value: 2 },
      { date: "2026-01-03", value: 6 },
    ]);
    const everyDay = series("lint", "lint", [
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-02", value: 1 },
      { date: "2026-01-03", value: 1 },
    ]);
    const layout = layoutOf([sparse, everyDay], CATEGORICAL, OTHER, OPTIONS);
    const mergeGate = layout.series.find((s) => s.key === "merge-gate")!;
    // Day 2 is a gap for merge-gate -- its two points must never share a segment.
    expect(mergeGate.segments).toEqual([]);
    expect(mergeGate.points).toHaveLength(2);

    const lint = layout.series.find((s) => s.key === "lint")!;
    expect(lint.segments).toHaveLength(1);
    expect(lint.segments[0]).toHaveLength(3);
  });
});

describe("layoutOf: single-point domain", () => {
  it("renders a one-day period as a single centred point, not an error", () => {
    const only = series("merge-gate", "merge-gate", [{ date: "2026-01-01", value: 4 }]);
    const layout = layoutOf([only], CATEGORICAL, OTHER, OPTIONS);
    expect(layout.isEmpty).toBe(false);
    expect(layout.domain).toEqual(["2026-01-01"]);
    const [point] = layout.series[0]!.points;
    expect(point!.x).toBeCloseTo(OPTIONS.width / 2);
    expect(layout.series[0]!.segments).toEqual([]);
    expect(layout.ticks).toHaveLength(1);
  });
});

describe("layoutOf: colour assignment", () => {
  it("assigns categorical colours by series order and falls back to `other` once exhausted", () => {
    const made = (key: string): TrendSeries => series(key, key, [{ date: "2026-01-01", value: 1 }]);
    const layout = layoutOf([made("a"), made("b"), made("c"), made("d")], CATEGORICAL, OTHER, OPTIONS);
    expect(layout.series.map((s) => s.color)).toEqual([...CATEGORICAL, OTHER]);
  });
});
