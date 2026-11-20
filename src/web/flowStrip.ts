import type { CfdBucket, FlowItem, FlowResult, FlowStageName } from "../server/flow.js";
import { FLOW_STAGES } from "../server/flow.js";
import { stageEnteredAt } from "./waitingOnPerson.js";

/**
 * The Overview page's flow strip, as a pure mapping from a `/api/flow` result to one card's
 * data per {@link FLOW_STAGES} entry (#162). Kept free of any rendering call, the same
 * convention `loopTable.ts`/`waitingOnPerson.ts` use -- the median/age/stuck arithmetic tests
 * directly, without mounting `FlowStrip`.
 */

/** A stage's median age exceeding this many hours gets the "stuck" treatment. A local
 *  constant, distinct from `waitingOnPerson.ts`'s own `STUCK_THRESHOLD_HOURS`: that one
 *  flags a single waiting item, this one flags a whole card, and #162 does not ask for them
 *  to share a threshold. */
export const CARD_STUCK_THRESHOLD_HOURS = 48;

/** The median of a set of millisecond ages, `0` for an empty set -- a stage with no items has
 *  nothing to be "stuck" about, not a missing figure. */
export function median(valuesMs: readonly number[]): number {
  if (valuesMs.length === 0) return 0;
  const sorted = [...valuesMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Every item's age in its *current* stage, from the last history entry's `enteredAt` to
 *  `now` -- the same proxy `waitingOnPerson.ts`'s `stageEnteredAt` already defines. */
export function ageInCurrentStageMs(item: FlowItem, now: Date): number {
  const enteredAt = stageEnteredAt(item);
  if (enteredAt === "") return 0;
  return now.getTime() - new Date(enteredAt).getTime();
}

/** One flow-strip card's data. */
export interface FlowCardData {
  readonly stage: FlowStageName;
  readonly count: number;
  readonly sparkline: readonly number[];
  readonly medianAgeMs: number;
  readonly stuck: boolean;
  readonly heldCount: number;
}

function sparklineOf(cfd: readonly CfdBucket[], stage: FlowStageName): number[] {
  return cfd.map((bucket) => bucket.counts[stage]);
}

/** One card per {@link FLOW_STAGES} entry, in table order -- every stage renders even when its
 *  count is `0`, never omitted (the issue's empty-stage edge case). */
export function cardDataOf(flow: Pick<FlowResult, "items" | "cfd">, now: Date): readonly FlowCardData[] {
  return FLOW_STAGES.map((stage) => {
    const items = flow.items.filter((item) => item.stage === stage);
    const medianAgeMs = median(items.map((item) => ageInCurrentStageMs(item, now)));
    return {
      stage,
      count: items.length,
      sparkline: sparklineOf(flow.cfd, stage),
      medianAgeMs,
      stuck: medianAgeMs > CARD_STUCK_THRESHOLD_HOURS * 3_600_000,
      heldCount: items.filter((item) => item.held).length,
    };
  });
}

/** Click-to-filter, as pure state transition: clicking an unselected (or differently
 *  selected) stage selects it; clicking the already-selected stage clears the filter. */
export function toggleStageFilter(
  current: FlowStageName | undefined,
  clicked: FlowStageName,
): FlowStageName | undefined {
  return current === clicked ? undefined : clicked;
}
