import type { FlowItem, FlowStageName } from "../server/flow.js";

/**
 * The Delivery page's "waiting on a person" list, as a pure mapping from `FlowItem[]` to one
 * row per item currently stuck on a human (#159's two questions: "where does time go", "who do
 * I need to go ask"). Kept free of any rendering call, the same convention `loopTable.ts` uses.
 */

export const WAITING_STAGES = ["needs-answers", "awaiting-review"] as const;
export type WaitingStage = (typeof WAITING_STAGES)[number];

/** An item sitting in a waiting stage past this many hours is flagged "stuck". A local
 *  constant: #162's flow strip does not exist yet, so there is no shared threshold to reuse. */
export const STUCK_THRESHOLD_HOURS = 48;

/** The last replayed history entry's `enteredAt` -- the best available proxy for when an item
 *  entered its *current* stage. `awaiting-review` can never appear as a history entry itself
 *  (#161's documented limitation: it depends on a linked pull request's state, which the issue
 *  timeline does not carry), so for that stage this is really "the last stage change the
 *  issue's own timeline does record", not a precise entry time. */
export function stageEnteredAt(item: FlowItem): string {
  return item.history[item.history.length - 1]?.enteredAt ?? "";
}

export interface WaitingRow {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly stage: FlowStageName;
  readonly enteredAt: string;
  readonly ageMs: number;
  readonly stuck: boolean;
  /** The review/question comment text, where the metrics cache exposes one -- always
   *  `undefined` today, since the cache does not fetch comments yet (out of scope, #165). */
  readonly questionText: string | undefined;
}

function isWaitingStage(stage: FlowStageName): stage is WaitingStage {
  return (WAITING_STAGES as readonly FlowStageName[]).includes(stage);
}

/** One row per item currently in {@link WAITING_STAGES}, oldest-entered-stage first. */
export function waitingRows(items: readonly FlowItem[], now: Date): WaitingRow[] {
  return items
    .filter((item): item is FlowItem & { stage: WaitingStage } => isWaitingStage(item.stage))
    .map((item) => {
      const enteredAt = stageEnteredAt(item);
      const ageMs = now.getTime() - new Date(enteredAt).getTime();
      return {
        issue: item.issue,
        title: item.title,
        url: item.url,
        stage: item.stage,
        enteredAt,
        ageMs,
        stuck: ageMs > STUCK_THRESHOLD_HOURS * 3_600_000,
        questionText: undefined,
      };
    })
    .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
}
