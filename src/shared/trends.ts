import type { LoopRun, Outcome } from "./types.js";
import { needsAttention } from "./types.js";

/**
 * Day-by-day aggregation of a run list, for the Loop page's trend panels.
 *
 * Every figure here is grouped straight from the same raw `LoopRun[]` a day's panels share --
 * there is no second counting path, so a day's runs-per-route, outcome mix, success rate,
 * median duration and share-needing-attention can never drift from a plain recount of that
 * day's runs (the issue's "counts must equal the router runs" rule).
 *
 * Bucketing uses the UTC calendar date of `startedAt`, matching how the loop already writes
 * that timestamp.
 */

/** The known outcomes plus "unknown", in the fixed order the outcome-mix trend reports them. */
export const outcomeMixKeys: readonly (Outcome | "unknown")[] =
  ["acted", "no-action", "handed-to-human", "failed", "unknown"];

export interface DailyTrendPoint {
  readonly day: string;
  readonly totalRuns: number;
  /** Absent for a route with no runs that day, never zero. */
  readonly runsByRoute: Readonly<Record<string, number>>;
  readonly outcomeMix: Readonly<Record<Outcome | "unknown", number>>;
  /** The share, in [0, 1], of known-outcome runs that are not "failed"; undefined when the
   *  day has no run of known outcome to compute a rate from. */
  readonly successRate: number | undefined;
  /** Milliseconds, keyed by route. Absent for a route with no finished run that day. */
  readonly medianDurationByRoute: Readonly<Record<string, number>>;
  /** The share, in [0, 1], of all that day's runs for which `needsAttention` is true. */
  readonly shareNeedingAttention: number;
}

/** The UTC calendar date of an ISO timestamp, as `YYYY-MM-DD`. */
export function dayOf(startedAt: string): string {
  return new Date(startedAt).toISOString().slice(0, 10);
}

/** Every run, grouped by the UTC calendar date of its `startedAt`. */
export function bucketByDay(runs: readonly LoopRun[]): ReadonlyMap<string, readonly LoopRun[]> {
  const byDay = new Map<string, LoopRun[]>();
  for (const run of runs) {
    const day = dayOf(run.startedAt);
    const bucket = byDay.get(day);
    if (bucket === undefined) byDay.set(day, [run]);
    else bucket.push(run);
  }
  return byDay;
}

/** One day's run counts, by route -- a route with no runs that day is absent from the result. */
export function runsByRouteOf(runs: readonly LoopRun[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const run of runs) counts[run.route] = (counts[run.route] ?? 0) + 1;
  return counts;
}

/** One day's run counts, by outcome, including "unknown". */
export function outcomeMixOf(runs: readonly LoopRun[]): Record<Outcome | "unknown", number> {
  const counts = Object.fromEntries(outcomeMixKeys.map((key) => [key, 0])) as
    Record<Outcome | "unknown", number>;
  for (const run of runs) counts[run.outcome] += 1;
  return counts;
}

/** The share of known-outcome runs that are not "failed"; undefined with no known-outcome
 *  run to compute a rate from. A "no-action" or "handed-to-human" run still counts as the
 *  loop doing what it was supposed to -- only "failed" counts against it. */
export function successRateOf(runs: readonly LoopRun[]): number | undefined {
  const known = runs.filter((run) => run.outcome !== "unknown");
  if (known.length === 0) return undefined;
  const succeeded = known.filter((run) => run.outcome !== "failed").length;
  return succeeded / known.length;
}

/** A run's duration in milliseconds, from its own timestamps -- undefined while it has not
 *  finished, never computed against `now()`. */
export function durationOf(run: LoopRun): number | undefined {
  if (run.finishedAt === undefined) return undefined;
  return new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** One day's median run duration, by route -- a route with no finished run that day is
 *  absent from the result, never a point at zero. */
export function medianDurationByRouteOf(runs: readonly LoopRun[]): Record<string, number> {
  const durationsByRoute = new Map<string, number[]>();
  for (const run of runs) {
    const duration = durationOf(run);
    if (duration === undefined) continue;
    const durations = durationsByRoute.get(run.route);
    if (durations === undefined) durationsByRoute.set(run.route, [duration]);
    else durations.push(duration);
  }
  const result: Record<string, number> = {};
  for (const [route, durations] of durationsByRoute) result[route] = median(durations);
  return result;
}

/** The share of all of that day's runs for which `needsAttention` is true. */
export function shareNeedingAttentionOf(runs: readonly LoopRun[]): number {
  if (runs.length === 0) return 0;
  return runs.filter(needsAttention).length / runs.length;
}

/** One day's full set of trend figures, computed straight from that day's raw run list. */
export function dailyTrendPointOf(day: string, runs: readonly LoopRun[]): DailyTrendPoint {
  return {
    day,
    totalRuns: runs.length,
    runsByRoute: runsByRouteOf(runs),
    outcomeMix: outcomeMixOf(runs),
    successRate: successRateOf(runs),
    medianDurationByRoute: medianDurationByRouteOf(runs),
    shareNeedingAttention: shareNeedingAttentionOf(runs),
  };
}

/** Every day with at least one run, in ascending order, each day's figures computed straight
 *  from that day's own slice of `runs` -- the single grouping step every trend panel reads. */
export function aggregateDailyTrends(runs: readonly LoopRun[]): readonly DailyTrendPoint[] {
  return [...bucketByDay(runs)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayRuns]) => dailyTrendPointOf(day, dayRuns));
}
