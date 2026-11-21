import type { LoopRun } from "../../shared/types.js";
import type { DailyTrendPoint } from "../../shared/trends.js";
import { aggregateDailyTrends } from "../../shared/trends.js";

/**
 * The Loop page's trend panels (#149), computed purely off an already-fetched snapshot --
 * like `computeLeadTime`, this never talks to the forge itself. The only work here is
 * narrowing `runs` to the requested period before handing them to `aggregateDailyTrends`
 * (src/shared/trends.ts), so there is still exactly one counting path from raw runs to a
 * day's figures.
 */

export interface LoopTrendsResult {
  readonly points: readonly DailyTrendPoint[];
}

/** Every run whose `startedAt` falls in `[from, to)`. */
function runsInWindow(runs: readonly LoopRun[], from: Date, to: Date): LoopRun[] {
  return runs.filter((run) => {
    const startedAt = new Date(run.startedAt).getTime();
    return startedAt >= from.getTime() && startedAt < to.getTime();
  });
}

export function computeLoopTrends(runs: readonly LoopRun[], from: Date, to: Date): LoopTrendsResult {
  return { points: aggregateDailyTrends(runsInWindow(runs, from, to)) };
}
