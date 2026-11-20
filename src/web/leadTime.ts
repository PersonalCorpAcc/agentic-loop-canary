import type { FlowItem } from "../server/flow.js";
import { median, percentile } from "../shared/stats.js";
import { shippedInPeriod } from "./timeInStageBar.js";

/** Median and 85th-percentile lead time (issue `createdAt` to `shipped`), in hours, over the
 *  items shipped in a period (#164). `excludedCount` is the number of shipped items dropped
 *  for not having a reliable creation lineage -- never folded into a negative or implausible
 *  duration. */
export interface LeadTimeStats {
  readonly median: number;
  readonly p85: number;
  readonly sampleCount: number;
  readonly excludedCount: number;
}

function lastEnteredAt(item: FlowItem): string | undefined {
  return item.history[item.history.length - 1]?.enteredAt;
}

/** Hours between `item.createdAt` and its `shipped` entry, or `undefined` when that duration
 *  is not a finite positive number -- the item has no reliable creation lineage. */
export function leadTimeHours(item: FlowItem): number | undefined {
  const shippedAt = lastEnteredAt(item);
  if (shippedAt === undefined) return undefined;
  const hours = (new Date(shippedAt).getTime() - new Date(item.createdAt).getTime()) / 3_600_000;
  return Number.isFinite(hours) && hours > 0 ? hours : undefined;
}

/** `{ median, p85 }` lead time in hours over items shipped in `[from, to]`. Computed
 *  regardless of sample size -- no special-cased minimum, since hiding it would be a silent
 *  gap, not a kindness. */
export function leadTimeStats(items: readonly FlowItem[], from: string, to: string): LeadTimeStats {
  const shipped = shippedInPeriod(items, from, to);
  const hours: number[] = [];
  let excludedCount = 0;
  for (const item of shipped) {
    const value = leadTimeHours(item);
    if (value === undefined) excludedCount += 1;
    else hours.push(value);
  }
  return { median: median(hours), p85: percentile(hours, 85), sampleCount: hours.length, excludedCount };
}
