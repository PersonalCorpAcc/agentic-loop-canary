import type { FlowItem, FlowStageName } from "../server/flow.js";

/**
 * The Delivery page's "where time goes" bar, as a pure mapping from `FlowItem[]` to one
 * stacked-bar row per shipped item (or a single averaged row, #159's rule for "more items
 * than are readable"). Kept free of any rendering call, the same convention `loopTable.ts`
 * uses -- type-only imports from `../server/flow.js` so this stays browser-safe.
 */

/** The five segments a bar renders, in the acceptance criteria's order. */
export const BAR_SEGMENTS: readonly FlowStageName[] = [
  "specifying",
  "building",
  "validating",
  "awaiting-review",
  "deploying",
];

/** Above this many shipped items in the period, render one averaged bar instead of one per item. */
export const READABLE_BAR_LIMIT = 12;

export interface BarSegment {
  readonly stage: FlowStageName;
  readonly ms: number;
}

export interface BarRow {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly segments: readonly BarSegment[];
}

function lastEnteredAt(item: FlowItem): string | undefined {
  return item.history[item.history.length - 1]?.enteredAt;
}

/** Items that shipped in `[from, to]`: stage `"shipped"` and the item's last history entry
 *  (the point it entered `shipped`) falling inside the window. */
export function shippedInPeriod(items: readonly FlowItem[], from: string, to: string): FlowItem[] {
  return items.filter((item) => {
    if (item.stage !== "shipped") return false;
    const enteredAt = lastEnteredAt(item);
    return enteredAt !== undefined && enteredAt >= from && enteredAt <= to;
  });
}

function segmentsOf(item: FlowItem): BarSegment[] {
  return BAR_SEGMENTS.map((stage) => ({ stage, ms: item.durationsMs[stage] }));
}

/**
 * One `BarRow` per item, or -- once `items` outgrows `limit` -- a single row averaging each
 * segment's duration across all of them. Callers pass an already-filtered shipped-in-period
 * list (see {@link shippedInPeriod}); this only decides individual-vs-averaged and shapes rows.
 */
export function timeInStageRows(
  items: readonly FlowItem[],
  limit: number = READABLE_BAR_LIMIT,
):
  | { readonly mode: "individual"; readonly rows: readonly BarRow[] }
  | { readonly mode: "averaged"; readonly row: BarRow; readonly count: number } {
  if (items.length <= limit) {
    return {
      mode: "individual",
      rows: items.map((item) => ({
        issue: item.issue,
        title: item.title,
        url: item.url,
        segments: segmentsOf(item),
      })),
    };
  }

  const segments = BAR_SEGMENTS.map((stage) => ({
    stage,
    ms: items.reduce((sum, item) => sum + item.durationsMs[stage], 0) / items.length,
  }));
  return {
    mode: "averaged",
    row: { issue: 0, title: "", url: "", segments },
    count: items.length,
  };
}
