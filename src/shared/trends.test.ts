import { describe, expect, it } from "vitest";

import {
  aggregateDailyTrends,
  bucketByDay,
  dailyTrendPointOf,
  dayOf,
  medianDurationByRouteOf,
  outcomeMixOf,
  runsByRouteOf,
  shareNeedingAttentionOf,
  successRateOf,
} from "./trends.js";
import type { LoopRun, Outcome } from "./types.js";

let nextId = 1;

function run(partial: Partial<LoopRun> & { readonly startedAt: string }): LoopRun {
  return {
    id: nextId++,
    route: "implement",
    outcome: "acted",
    reason: "",
    subject: "-",
    url: "https://github.com/acme/infra/actions/runs/1",
    ...partial,
  };
}

describe("bucketing runs by day", () => {
  it("keys the UTC calendar date of startedAt", () => {
    expect(dayOf("2026-03-05T23:59:00Z")).toBe("2026-03-05");
    expect(dayOf("2026-03-06T00:01:00Z")).toBe("2026-03-06");
  });

  it("groups runs across several days, in ascending order", () => {
    const runs = [
      run({ startedAt: "2026-03-06T10:00:00Z" }),
      run({ startedAt: "2026-03-05T10:00:00Z" }),
      run({ startedAt: "2026-03-05T11:00:00Z" }),
    ];
    const byDay = bucketByDay(runs);
    expect([...byDay.keys()]).toEqual(["2026-03-06", "2026-03-05"]);
    expect(byDay.get("2026-03-05")).toHaveLength(2);
  });
});

describe("runs per route is a trend broken out by route", () => {
  it("counts each route separately and leaves a routeless day absent", () => {
    const runs = [
      run({ route: "merge-gate", startedAt: "2026-03-05T01:00:00Z" }),
      run({ route: "merge-gate", startedAt: "2026-03-05T02:00:00Z" }),
      run({ route: "implement", startedAt: "2026-03-05T03:00:00Z" }),
    ];
    expect(runsByRouteOf(runs)).toEqual({ "merge-gate": 2, implement: 1 });
    expect(runsByRouteOf(runs)["promote"]).toBeUndefined();
  });
});

describe("outcome mix is a trend", () => {
  it("breaks a day down into the four known outcomes plus unknown, with no separate declined", () => {
    const outcomes: (Outcome | "unknown")[] =
      ["acted", "no-action", "handed-to-human", "failed", "unknown"];
    const runs = outcomes.map((outcome) => run({ outcome, startedAt: "2026-03-05T01:00:00Z" }));
    expect(outcomeMixOf(runs)).toEqual({
      acted: 1,
      "no-action": 1,
      "handed-to-human": 1,
      failed: 1,
      unknown: 1,
    });
  });
});

describe("success rate is a trend", () => {
  it("is the share of known-outcome runs that are not failed", () => {
    const runs = [
      ...Array.from({ length: 8 }, () => run({ outcome: "acted", startedAt: "2026-03-05T01:00:00Z" })),
      ...Array.from({ length: 2 }, () => run({ outcome: "failed", startedAt: "2026-03-05T01:00:00Z" })),
    ];
    expect(successRateOf(runs)).toBe(0.8);
  });

  it("counts no-action and handed-to-human as success, only failed against it", () => {
    const runs = [
      run({ outcome: "no-action", startedAt: "2026-03-05T01:00:00Z" }),
      run({ outcome: "handed-to-human", startedAt: "2026-03-05T01:00:00Z" }),
      run({ outcome: "failed", startedAt: "2026-03-05T01:00:00Z" }),
    ];
    expect(successRateOf(runs)).toBeCloseTo(2 / 3);
  });

  it("excludes unknown-outcome runs from the denominator", () => {
    const runs = [
      run({ outcome: "acted", startedAt: "2026-03-05T01:00:00Z" }),
      run({ outcome: "unknown", startedAt: "2026-03-05T01:00:00Z" }),
    ];
    expect(successRateOf(runs)).toBe(1);
  });

  it("is undefined for a day with no known-outcome run", () => {
    expect(successRateOf([run({ outcome: "unknown", startedAt: "2026-03-05T01:00:00Z" })])).toBeUndefined();
  });
});

describe("median duration per route is a trend", () => {
  it("is the median of that route's finished runs that day", () => {
    const minutes = (n: number): string => new Date(Date.parse("2026-03-05T00:00:00Z") + n * 60_000).toISOString();
    const runs = [2, 4, 6].map((length) => run({
      route: "merge-gate",
      startedAt: "2026-03-05T00:00:00Z",
      finishedAt: minutes(length),
    }));
    expect(medianDurationByRouteOf(runs)).toEqual({ "merge-gate": 4 * 60_000 });
  });

  it("leaves a route with no finished run that day absent, not a point at zero", () => {
    const runs = [run({ route: "implement", startedAt: "2026-03-05T00:00:00Z" })];
    expect(medianDurationByRouteOf(runs)).toEqual({});
    expect(medianDurationByRouteOf(runs)["implement"]).toBeUndefined();
  });

  it("never computes a running run's duration against now()", () => {
    const runs = [run({ route: "implement", startedAt: "2026-03-05T00:00:00Z" })];
    expect(medianDurationByRouteOf(runs)["implement"]).toBeUndefined();
  });
});

describe("share needing a person is a trend", () => {
  it("is the share of that day's runs that needed a person", () => {
    const runs = [
      ...Array.from({ length: 9 }, () => run({ outcome: "acted", startedAt: "2026-03-05T01:00:00Z" })),
      ...Array.from({ length: 2 }, () => run({ outcome: "handed-to-human", startedAt: "2026-03-05T01:00:00Z" })),
      run({ outcome: "failed", startedAt: "2026-03-05T01:00:00Z" }),
    ];
    expect(shareNeedingAttentionOf(runs)).toBeCloseTo(0.25);
  });
});

describe("a day's figures equal the raw runs for that day", () => {
  it("matches a brute-force recount of the same fixture for every day", () => {
    const fixture: LoopRun[] = [
      run({ route: "merge-gate", outcome: "acted", startedAt: "2026-03-05T01:00:00Z", finishedAt: "2026-03-05T01:02:00Z" }),
      run({ route: "merge-gate", outcome: "failed", startedAt: "2026-03-05T02:00:00Z", finishedAt: "2026-03-05T02:04:00Z" }),
      run({ route: "implement", outcome: "handed-to-human", startedAt: "2026-03-05T03:00:00Z" }),
      run({ route: "implement", outcome: "unknown", startedAt: "2026-03-06T01:00:00Z" }),
      run({ route: "merge-gate", outcome: "acted", startedAt: "2026-03-06T02:00:00Z", finishedAt: "2026-03-06T02:06:00Z" }),
    ];

    const trends = aggregateDailyTrends(fixture);
    expect(trends.map((point) => point.day)).toEqual(["2026-03-05", "2026-03-06"]);

    for (const point of trends) {
      const recount = fixture.filter((run) => dayOf(run.startedAt) === point.day);
      expect(point).toEqual(dailyTrendPointOf(point.day, recount));
      expect(point.totalRuns).toBe(recount.length);
    }
  });
});

describe("a one-day period", () => {
  it("still renders a single point rather than erroring on an empty range", () => {
    const trends = aggregateDailyTrends([run({ startedAt: "2026-03-05T12:00:00Z" })]);
    expect(trends).toHaveLength(1);
    expect(trends[0]!.day).toBe("2026-03-05");
  });
});

describe("no data at all", () => {
  it("produces no days, for the trend panels' empty state to render against", () => {
    expect(aggregateDailyTrends([])).toEqual([]);
  });
});
