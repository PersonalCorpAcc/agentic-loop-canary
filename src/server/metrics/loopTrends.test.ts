import { describe, expect, it } from "vitest";

import { computeLoopTrends } from "./loopTrends.js";
import { aggregateDailyTrends } from "../../shared/trends.js";
import type { LoopRun } from "../../shared/types.js";

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

describe("computeLoopTrends", () => {
  it("excludes runs outside the [from, to) window", () => {
    const inWindow = run({ startedAt: "2026-03-05T10:00:00Z" });
    const before = run({ startedAt: "2026-03-01T10:00:00Z" });
    const atTo = run({ startedAt: "2026-03-10T00:00:00Z" });
    const result = computeLoopTrends(
      [before, inWindow, atTo],
      new Date("2026-03-03T00:00:00Z"),
      new Date("2026-03-10T00:00:00Z"),
    );
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.day).toBe("2026-03-05");
    expect(result.points[0]?.totalRuns).toBe(1);
  });

  it("a day's figures equal a brute-force recount of that day's runs in the window (counts must equal the router runs)", () => {
    const runs = [
      run({ startedAt: "2026-03-05T01:00:00Z", route: "implement", outcome: "acted" }),
      run({ startedAt: "2026-03-05T02:00:00Z", route: "merge-gate", outcome: "failed" }),
      run({ startedAt: "2026-03-06T03:00:00Z", route: "implement", outcome: "handed-to-human" }),
      run({ startedAt: "2026-02-01T00:00:00Z", route: "implement", outcome: "acted" }),
    ];
    const from = new Date("2026-03-01T00:00:00Z");
    const to = new Date("2026-03-31T00:00:00Z");
    const result = computeLoopTrends(runs, from, to);

    const inWindow = runs.filter((candidate) => {
      const startedAt = new Date(candidate.startedAt).getTime();
      return startedAt >= from.getTime() && startedAt < to.getTime();
    });
    expect(result.points).toEqual(aggregateDailyTrends(inWindow));
  });

  it("returns no points for an empty run list", () => {
    const result = computeLoopTrends([], new Date("2026-03-01T00:00:00Z"), new Date("2026-03-02T00:00:00Z"));
    expect(result.points).toEqual([]);
  });
});
