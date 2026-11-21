import { carriesHotfix, INCIDENT_LABELS, type IssueTimeline } from "./timeline.js";

/**
 * Time to restore: days from a `hold`/`rollback` label landing to it clearing, attributed
 * to the day it cleared. Tracked per label name rather than treating "any incident label
 * present" as one span, so a held-released-held-again issue yields two samples (one per
 * hold/release pair) and a `hold`-then-later-`rollback` issue yields two independent
 * samples, matching this story's own edge cases rather than merging them into one.
 */

const MS_PER_DAY = 86_400_000;
const WEEKLY_THRESHOLD_DAYS = 30;

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

export interface TimeToRestoreBucket {
  readonly date: string;
  readonly averageDays: number;
  readonly count: number;
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

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday-anchored UTC week start -- the same convention `deploymentFrequency.ts`/
 *  `changeFailureRate.ts` use, so a bucket label never depends on where `from` falls
 *  mid-week. */
function utcWeekStart(date: Date): Date {
  const day = utcDay(date);
  const isoDayOfWeek = (day.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  day.setUTCDate(day.getUTCDate() - isoDayOfWeek);
  return day;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function granularityOf(from: Date, to: Date): "day" | "week" {
  const spanDays = (to.getTime() - from.getTime()) / MS_PER_DAY;
  return spanDays > WEEKLY_THRESHOLD_DAYS ? "week" : "day";
}

function bucketKeyOf(at: string, granularity: "day" | "week"): string {
  const date = new Date(at);
  return granularity === "week" ? toDateKey(utcWeekStart(date)) : toDateKey(utcDay(date));
}

function emptyBuckets(from: Date, to: Date, granularity: "day" | "week"): Map<string, { total: number; count: number }> {
  const buckets = new Map<string, { total: number; count: number }>();
  const step = granularity === "week" ? 7 : 1;
  const cursor = granularity === "week" ? utcWeekStart(from) : utcDay(from);
  const end = granularity === "week" ? utcWeekStart(to) : utcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    buckets.set(toDateKey(cursor), { total: 0, count: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return buckets;
}

/** One `{date, averageDays, count}` bucket per calendar day/week in `[from, to]`, every one
 *  present (never an absent key), bucketed by each sample's *clearing* date -- matching
 *  {@link computeTimeToRestore}'s own window filter. `averageDays` is `0` rather than `NaN`
 *  on a bucket nothing cleared in. */
export function timeToRestoreBuckets(
  timelines: readonly IssueTimeline[],
  from: Date,
  to: Date,
): { buckets: TimeToRestoreBucket[]; granularity: "day" | "week" } {
  const granularity = granularityOf(from, to);
  const totals = emptyBuckets(from, to, granularity);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const samples = timelines.filter((timeline) => !carriesHotfix(timeline)).flatMap((timeline) => restoreSamplesFor(timeline));

  for (const sample of samples) {
    const closedAt = new Date(sample.closedAt).getTime();
    if (closedAt < fromMs || closedAt > toMs) continue;

    const key = bucketKeyOf(sample.closedAt, granularity);
    const bucket = totals.get(key);
    if (bucket === undefined) continue;
    bucket.total += sample.days;
    bucket.count += 1;
  }

  const buckets = [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({ date, averageDays: count === 0 ? 0 : total / count, count }));

  return { buckets, granularity };
}
