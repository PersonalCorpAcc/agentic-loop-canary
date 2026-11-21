import type { TimelineEvent } from "../metrics.js";

/**
 * Deployment frequency: changes merged into the chain's final stage (`main`, per
 * `.agentic/profile.yml`'s `branching.chain`/`closeIssueOn`), counted per issue on the UTC
 * day/week its `merged-main` label landed. A batched `env-promotion` merge stamps that
 * label on every carried issue individually, so counting per-issue label arrivals already
 * gives a three-issue batch a count of three for the day it landed -- no separate
 * `LoopRun.carriedIssues` lookup needed.
 */

const MS_PER_DAY = 86_400_000;
const WEEKLY_THRESHOLD_DAYS = 30;

export interface DeploymentFrequencyEntry {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly mergedAt: string;
}

export interface DeploymentFrequencyBucket {
  readonly date: string;
  readonly count: number;
}

export interface DeploymentFrequencyResult {
  readonly entries: readonly DeploymentFrequencyEntry[];
  readonly buckets: readonly DeploymentFrequencyBucket[];
  readonly granularity: "day" | "week";
  readonly total: number;
  readonly previousTotal: number;
}

/** This issue's labelling events, oldest first -- a timeline generally arrives in that
 *  order already, but a replay must not assume that. */
function labeledEventsOf(events: readonly TimelineEvent[]): (TimelineEvent & { created_at: string })[] {
  return events
    .filter(
      (event): event is TimelineEvent & { created_at: string } =>
        event.event === "labeled" && event.created_at !== undefined,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The first (earliest) time `mergedLabel` landed on this issue, or `undefined` if it
 *  never did. Unlike `leadTime.ts`'s `implement` tracking -- which deliberately uses the
 *  *latest* occurrence after a remove-and-re-add -- the stage-arrival label is a one-way
 *  door once a change ships, so the first occurrence is the one that matters here. */
function mergedAtOf(events: readonly TimelineEvent[], mergedLabel: string): string | undefined {
  return labeledEventsOf(events).find((event) => event.label?.name === mergedLabel)?.created_at;
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday-anchored UTC week start for `date` (ISO's own week start, not the US Sunday
 *  start), so a weekly bucket's label is deterministic regardless of where `from` falls
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

function bucketKeyOf(mergedAt: string, granularity: "day" | "week"): string {
  const date = new Date(mergedAt);
  return granularity === "week" ? toDateKey(utcWeekStart(date)) : toDateKey(utcDay(date));
}

/** Every bucket boundary in `[from, to]`, inclusive, each starting at `0` -- the same
 *  "never an absent key" convention `flow.ts`'s `cfdBuckets` already uses. */
function emptyBuckets(from: Date, to: Date, granularity: "day" | "week"): Map<string, number> {
  const buckets = new Map<string, number>();
  const step = granularity === "week" ? 7 : 1;
  const cursor = granularity === "week" ? utcWeekStart(from) : utcDay(from);
  const end = granularity === "week" ? utcWeekStart(to) : utcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    buckets.set(toDateKey(cursor), 0);
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return buckets;
}

/** `inclusiveEnd` excludes `to` itself when `false`, so the previous-period window
 *  (`[from - length, from)`) never double-counts an entry landing exactly on `from` with
 *  the current period's own `[from, to]`. */
function countMerged(
  issues: readonly { number: number }[],
  timelines: Record<number, readonly TimelineEvent[]>,
  from: Date,
  to: Date,
  mergedLabel: string,
  inclusiveEnd = true,
): number {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  let count = 0;
  for (const issue of issues) {
    const mergedAt = mergedAtOf(timelines[issue.number] ?? [], mergedLabel);
    if (mergedAt === undefined) continue;
    const withinEnd = inclusiveEnd ? mergedAt <= toIso : mergedAt < toIso;
    if (mergedAt >= fromIso && withinEnd) count += 1;
  }
  return count;
}

export function computeDeploymentFrequency(
  issues: readonly { number: number; title: string; html_url: string }[],
  timelines: Record<number, readonly TimelineEvent[]>,
  from: Date,
  to: Date,
  mergedLabel = "merged-main",
): DeploymentFrequencyResult {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const entries = issues
    .map((issue) => {
      const mergedAt = mergedAtOf(timelines[issue.number] ?? [], mergedLabel);
      if (mergedAt === undefined) return undefined;
      const entry: DeploymentFrequencyEntry = { issue: issue.number, title: issue.title, url: issue.html_url, mergedAt };
      return entry;
    })
    .filter((entry): entry is DeploymentFrequencyEntry => entry !== undefined)
    .filter((entry) => entry.mergedAt >= fromIso && entry.mergedAt <= toIso)
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));

  const granularity = granularityOf(from, to);
  const bucketCounts = emptyBuckets(from, to, granularity);
  for (const entry of entries) {
    const key = bucketKeyOf(entry.mergedAt, granularity);
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }
  const buckets = [...bucketCounts].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  const previousTotal = countMerged(issues, timelines, previousFrom, from, mergedLabel, false);

  return { entries, buckets, granularity, total: entries.length, previousTotal };
}
