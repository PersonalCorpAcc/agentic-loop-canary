/**
 * Change-failure-rate formatting helpers, browser-safe (#219). The fetched
 * `/api/change-failure-rate` JSON already has everything a page needs computed
 * server-side -- this only turns `rate` into a whole-percent string and
 * `shipped`/`previousShipped`/`rate`/`previousRate` into the delta line.
 */

import type { ChangeFailureEntry, ChangeFailureRateBucket } from "../server/metrics/changeFailureRate.js";

/** The shape `/api/change-failure-rate` responds with -- current and previous windows
 *  side by side, both already computed server-side. */
export interface ChangeFailureRateApiResult {
  readonly shipped: number;
  readonly rate: number;
  readonly previousShipped: number;
  readonly previousRate: number;
  readonly buckets: readonly ChangeFailureRateBucket[];
  readonly previousBuckets: readonly ChangeFailureRateBucket[];
  readonly granularity: "day" | "week";
  readonly entries: readonly ChangeFailureEntry[];
}

export function formatChangeFailureRatePercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatChangeFailureRateDelta(
  shipped: number,
  previousShipped: number,
  rate: number,
  previousRate: number,
): string {
  if (shipped === 0) return "no changes shipped in this period";
  if (previousShipped === 0) return "no prior data";
  const deltaPoints = Math.round(rate * 100) - Math.round(previousRate * 100);
  if (deltaPoints === 0) return "no change vs previous period";
  const sign = deltaPoints > 0 ? "+" : "";
  return `${sign}${deltaPoints}pp vs previous period`;
}
