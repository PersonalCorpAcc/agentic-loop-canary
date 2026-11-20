import { carriesHotfix, INCIDENT_LABELS, type IssueTimeline } from "./timeline.js";

/**
 * Time to restore: days from a `hold`/`rollback` label landing to it clearing, attributed
 * to the day it cleared. Tracked per label name rather than treating "any incident label
 * present" as one span, so a held-released-held-again issue yields two samples (one per
 * hold/release pair) and a `hold`-then-later-`rollback` issue yields two independent
 * samples, matching this story's own edge cases rather than merging them into one.
 */

const MS_PER_DAY = 86_400_000;

export interface RestoreSample {
  readonly issue: number;
  readonly label: string;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly days: number;
}

export interface TimeToRestoreResult {
  readonly samples: readonly RestoreSample[];
  readonly averageDays: number;
}

const INCIDENT_LABEL_NAMES: readonly string[] = INCIDENT_LABELS;

/** Every `hold`/`rollback` add-and-clear pair on one issue's timeline, oldest first -- the
 *  timeline's own order, which is the forge's `/events` order. A `labeled` event for a label
 *  already open is ignored (the span keeps its original start); an `unlabeled` event with
 *  nothing open for that label (already closed, or never opened in this timeline) is
 *  ignored rather than producing a negative duration. */
function restoreSamplesFor(timeline: IssueTimeline): RestoreSample[] {
  const samples: RestoreSample[] = [];
  const openedAt = new Map<string, string>();

  for (const event of timeline.events) {
    const label = event.label?.name;
    if (label === undefined || !INCIDENT_LABEL_NAMES.includes(label)) continue;

    if (event.event === "labeled") {
      if (!openedAt.has(label)) openedAt.set(label, event.created_at);
      continue;
    }
    if (event.event !== "unlabeled") continue;

    const start = openedAt.get(label);
    if (start === undefined) continue;
    openedAt.delete(label);

    const days = (new Date(event.created_at).getTime() - new Date(start).getTime()) / MS_PER_DAY;
    samples.push({ issue: timeline.issue, label, openedAt: start, closedAt: event.created_at, days });
  }

  return samples;
}

/** Samples across every issue, restricted to incidents whose *clearing* event falls in
 *  `[since, until]` -- an incident still open has no clearing event yet, so it is excluded
 *  here even though it still counts toward change failure rate. `averageDays` is `0` rather
 *  than `NaN` when nothing cleared in the period. */
export function computeTimeToRestore(
  timelines: readonly IssueTimeline[],
  since: Date,
  until: Date,
): TimeToRestoreResult {
  const samples = timelines
    .filter((timeline) => !carriesHotfix(timeline))
    .flatMap((timeline) => restoreSamplesFor(timeline))
    .filter((sample) => {
      const closedAt = new Date(sample.closedAt).getTime();
      return closedAt >= since.getTime() && closedAt <= until.getTime();
    });

  const averageDays = samples.length === 0 ? 0 : samples.reduce((sum, sample) => sum + sample.days, 0) / samples.length;
  return { samples, averageDays };
}
