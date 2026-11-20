import { carriesHotfix, everCarriedIncidentLabel, type IssueTimeline } from "./timeline.js";

/**
 * Change failure rate: the share of changes shipped in a period that ever carried `hold` or
 * `rollback` -- including a revert, which `promote-change.sh` already turns into the same
 * `rollback` label before refusing to carry the change further, so this reads that one
 * label timeline rather than scanning git history a second time.
 */

export interface ChangeFailureRateResult {
  readonly shipped: number;
  readonly failed: readonly number[];
  readonly rate: number;
}

function shippedAt(timeline: IssueTimeline, mergedLabel: string): string | undefined {
  return timeline.events.find((event) => event.event === "labeled" && event.label?.name === mergedLabel)?.created_at;
}

/** `shipped` is every issue (excluding ones that ever carried `hotfix`) whose `mergedLabel`
 *  landed within `[since, until]`; `failed` is the subset of those whose timeline ever
 *  carried `hold` or `rollback`, at any time -- a hold raised after the change shipped
 *  still counts it as having needed intervention. `rate` is `0` rather than `NaN` when
 *  nothing shipped in the period. */
export function computeChangeFailureRate(
  timelines: readonly IssueTimeline[],
  mergedLabel: string,
  since: Date,
  until: Date,
): ChangeFailureRateResult {
  const failed: number[] = [];
  let shipped = 0;

  for (const timeline of timelines) {
    if (carriesHotfix(timeline)) continue;

    const arrival = shippedAt(timeline, mergedLabel);
    if (arrival === undefined) continue;

    const arrivedAt = new Date(arrival).getTime();
    if (arrivedAt < since.getTime() || arrivedAt > until.getTime()) continue;

    shipped += 1;
    if (everCarriedIncidentLabel(timeline)) failed.push(timeline.issue);
  }

  failed.sort((a, b) => a - b);
  return { shipped, failed, rate: shipped === 0 ? 0 : failed.length / shipped };
}
