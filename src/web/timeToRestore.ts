/**
 * Time-to-restore formatting helpers, browser-safe (#219). The fetched
 * `/api/time-to-restore` JSON already has everything a page needs computed
 * server-side -- this is the rendering-time transform: one decimal place for
 * `averageDays` (matching `formatLeadTimeDays`) and the delta line against the
 * previous period's sample count/average.
 */

import type { TimeToRestoreBucket } from "../server/metrics/timeToRestore.js";

/** The shape `/api/time-to-restore` responds with -- current and previous windows
 *  side by side, both already computed server-side. */
export interface TimeToRestoreApiResult {
  readonly averageDays: number;
  readonly sampleCount: number;
  readonly previousAverageDays: number;
  readonly previousSampleCount: number;
  readonly buckets: readonly TimeToRestoreBucket[];
  readonly previousBuckets: readonly TimeToRestoreBucket[];
  readonly granularity: "day" | "week";
}

export function formatTimeToRestoreDays(days: number): string {
  return `${days.toFixed(1)}d`;
}

export function formatTimeToRestoreDelta(
  sampleCount: number,
  previousSampleCount: number,
  averageDays: number,
  previousAverageDays: number,
): string {
  if (sampleCount === 0) return "no incidents resolved in this period";
  if (previousSampleCount === 0) return "no prior data";
  const delta = averageDays - previousAverageDays;
  if (delta === 0) return "no change vs previous period";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}d vs previous period`;
}
