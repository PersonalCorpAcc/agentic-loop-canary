import type { CfdBucket, FlowItem, FlowStageName } from "../server/flow.js";
import { FLOW_STAGES } from "../server/flow.js";
import { STUCK_THRESHOLD_HOURS, stageEnteredAt } from "./waitingOnPerson.js";

/**
 * The Overview page's flow strip (#162), as a pure mapping from `FlowResult`'s `items` / `cfd`
 * to one `StageCard` per {@link FLOW_STAGES} entry, plus the click-to-filter toggle. Kept free
 * of any rendering call, the same convention `timeInStageBar.ts` / `waitingOnPerson.ts` use --
 * type-only imports from `../server/flow.js` so this stays browser-safe. Reuses
 * `STUCK_THRESHOLD_HOURS` / `stageEnteredAt` from `waitingOnPerson.ts` rather than redefining
 * the "how old is too old" rule a second time.
 */

/** The middle value of a numeric series, averaging the two middle values for an even-length
 *  one. `0` for an empty series -- a stage with no items has no age to report, and `0` is less
 *  misleading than `NaN` on a card that is going to render a number either way. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** The `sp-N` estimate off an issue's own labels (the first one that matches), or `undefined`
 *  where none of its labels carry an estimate. */
export function estimateOf(labels: readonly string[]): number | undefined {
  for (const label of labels) {
    const match = /^sp-(\d+)$/.exec(label);
    if (match !== null) return Number(match[1]);
  }
  return undefined;
}

export interface StageCard {
  readonly stage: FlowStageName;
  /** Current item count in this stage -- rendered even when `0` (the issue's "empty stage
   *  still renders `0`" edge case; this is never omitted from the returned array either). */
  readonly count: number;
  /** This stage's `cfd` count over the period, oldest first -- the per-card sparkline series. */
  readonly sparkline: readonly number[];
  /** Median time-in-stage across this stage's current items, in milliseconds. */
  readonly medianAgeMs: number;
  /** `medianAgeMs` past `STUCK_THRESHOLD_HOURS` -- the amber-glow condition. `false` for an
   *  empty stage, since `median([])` is `0`. */
  readonly stuck: boolean;
  /** How many of this stage's current items carry `held` -- the red badge's count. */
  readonly heldCount: number;
}

/** One {@link StageCard} per {@link FLOW_STAGES} entry, left to right, table order. */
export function flowStripCards(
  items: readonly FlowItem[],
  cfd: readonly CfdBucket[],
  now: Date,
): StageCard[] {
  return FLOW_STAGES.map((stage) => {
    const stageItems = items.filter((item) => item.stage === stage);
    const ages = stageItems.map((item) => now.getTime() - new Date(stageEnteredAt(item)).getTime());
    const medianAgeMs = median(ages);
    return {
      stage,
      count: stageItems.length,
      sparkline: cfd.map((bucket) => bucket.counts[stage]),
      medianAgeMs,
      stuck: medianAgeMs > STUCK_THRESHOLD_HOURS * 3_600_000,
      heldCount: stageItems.filter((item) => item.held).length,
    };
  });
}

/** Selecting a stage narrows to it; selecting the same one again clears the filter -- the
 *  flow strip's click-to-filter toggle (#162). */
export function toggleStageFilter(
  current: FlowStageName | undefined,
  clicked: FlowStageName,
): FlowStageName | undefined {
  return current === clicked ? undefined : clicked;
}
