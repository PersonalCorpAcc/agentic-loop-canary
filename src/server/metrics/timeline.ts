/**
 * The label-event shape both change-failure-rate and time-to-restore read.
 *
 * This matches the `IssueTimeline`/`LabelEvent` shape `deploymentFrequency.ts` introduces
 * (#143, not yet merged to this branch): once that lands, this file folds into it rather
 * than keeping two definitions of the same thing, as that module's own comment already
 * anticipates ("the two future children of #139 ... reuse this same timeline fetch").
 */

export interface LabelEvent {
  readonly event: string;
  readonly created_at: string;
  readonly label?: { readonly name: string };
}

export interface IssueTimeline {
  readonly issue: number;
  readonly events: readonly LabelEvent[];
}

/** The two labels this story's metrics read. `hotfix` -- the third label `stages.ts`'s
 *  `blockingLabelOf` recognises -- is deliberately not here: the issue that introduced
 *  these metrics excludes it from both. */
export const INCIDENT_LABELS = ["hold", "rollback"] as const;

function hasLabelEvent(timeline: IssueTimeline, event: string, labelName: string): boolean {
  return timeline.events.some((candidate) => candidate.event === event && candidate.label?.name === labelName);
}

/** True once `hotfix` has ever landed on the issue -- excluded from both metrics regardless
 *  of whether it is still present, matching the issue's "hotfix present on an issue:
 *  excluded from both metrics" edge case. */
export function carriesHotfix(timeline: IssueTimeline): boolean {
  return hasLabelEvent(timeline, "labeled", "hotfix");
}

/** True once `hold` or `rollback` has ever landed on the issue, however that happened --
 *  including `promote-change.sh`'s own revert detection, which stamps `rollback` through
 *  the same label rather than a separate signal. */
export function everCarriedIncidentLabel(timeline: IssueTimeline): boolean {
  return INCIDENT_LABELS.some((label) => hasLabelEvent(timeline, "labeled", label));
}
