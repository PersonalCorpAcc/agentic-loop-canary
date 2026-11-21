import { carriedIssuesOf } from "../runs.js";
import { carriesHotfix, everCarriedIncidentLabel, INCIDENT_LABELS, type IssueTimeline } from "./timeline.js";

/**
 * Change failure rate: the share of changes shipped in a period that ever carried `hold` or
 * `rollback` -- including a revert, which `promote-change.sh` already turns into the same
 * `rollback` label before refusing to carry the change further, so this reads that one
 * label timeline rather than scanning git history a second time.
 */

const MS_PER_DAY = 86_400_000;
const WEEKLY_THRESHOLD_DAYS = 30;

export interface ChangeFailureRateResult {
  readonly shipped: number;
  readonly failed: readonly number[];
  readonly rate: number;
}

export interface ChangeFailureRateBucket {
  readonly date: string;
  readonly shipped: number;
  readonly failed: number;
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

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday-anchored UTC week start -- the same convention `deploymentFrequency.ts` uses, so
 *  a bucket label never depends on where `from` falls mid-week. */
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

function emptyBuckets(from: Date, to: Date, granularity: "day" | "week"): Map<string, { shipped: number; failed: number }> {
  const buckets = new Map<string, { shipped: number; failed: number }>();
  const step = granularity === "week" ? 7 : 1;
  const cursor = granularity === "week" ? utcWeekStart(from) : utcDay(from);
  const end = granularity === "week" ? utcWeekStart(to) : utcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    buckets.set(toDateKey(cursor), { shipped: 0, failed: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return buckets;
}

/** One `{date, shipped, failed, rate}` bucket per calendar day/week in `[from, to]`,
 *  every one present (never an absent key, the same convention `deploymentFrequency.ts`'s
 *  own bucket builder uses) -- `rate` is `0` rather than `NaN` on a bucket nothing shipped
 *  in, matching {@link computeChangeFailureRate}'s own zero-shipped convention. */
export function changeFailureRateBuckets(
  timelines: readonly IssueTimeline[],
  mergedLabel: string,
  from: Date,
  to: Date,
): { buckets: ChangeFailureRateBucket[]; granularity: "day" | "week" } {
  const granularity = granularityOf(from, to);
  const counts = emptyBuckets(from, to, granularity);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const timeline of timelines) {
    if (carriesHotfix(timeline)) continue;
    const arrival = shippedAt(timeline, mergedLabel);
    if (arrival === undefined) continue;
    const arrivedAt = new Date(arrival).getTime();
    if (arrivedAt < fromMs || arrivedAt > toMs) continue;

    const key = bucketKeyOf(arrival, granularity);
    const bucket = counts.get(key);
    if (bucket === undefined) continue;
    bucket.shipped += 1;
    if (everCarriedIncidentLabel(timeline)) bucket.failed += 1;
  }

  const buckets = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { shipped, failed }]) => ({ date, shipped, failed, rate: shipped === 0 ? 0 : failed / shipped }));

  return { buckets, granularity };
}

export interface ChangeFailureEntry {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly pullRequest: { readonly number: number; readonly url: string } | undefined;
  readonly label: string;
  readonly openedAt: string;
  readonly closedAt: string | undefined;
  readonly days: number | undefined;
}

/** The earliest hold/rollback span on this timeline, closed or still open -- unlike
 *  {@link computeTimeToRestore}'s `restoreSamplesFor`, which only ever emits a *closed*
 *  span, a failed-changes row needs to show an incident still in progress too (`closedAt`/
 *  `days` undefined), so this reads `labeled`/`unlabeled` pairs the same way but keeps the
 *  first span whether or not an `unlabeled` ever arrived for it. */
function firstIncidentSpanOf(
  timeline: IssueTimeline,
): { label: string; openedAt: string; closedAt: string | undefined; days: number | undefined } | undefined {
  const openedAt = new Map<string, string>();
  let first: { label: string; openedAt: string } | undefined;

  for (const event of timeline.events) {
    const label = event.label?.name;
    if (label === undefined || !(INCIDENT_LABELS as readonly string[]).includes(label)) continue;

    if (event.event === "labeled") {
      if (!openedAt.has(label)) {
        openedAt.set(label, event.created_at);
        if (first === undefined) first = { label, openedAt: event.created_at };
      }
      continue;
    }
    if (event.event !== "unlabeled") continue;

    const start = openedAt.get(label);
    if (start === undefined) continue;
    openedAt.delete(label);
    if (first?.label === label && first.openedAt === start) {
      const days = (new Date(event.created_at).getTime() - new Date(start).getTime()) / MS_PER_DAY;
      return { label, openedAt: start, closedAt: event.created_at, days };
    }
  }

  return first === undefined ? undefined : { ...first, closedAt: undefined, days: undefined };
}

/** The implementing pull request for `issue`, if one is still discoverable -- the same
 *  `implement-issue` marker grammar `flow.ts`'s `linkedPrOf` already reads, preferring an
 *  open one and otherwise the first closed one found, so a shipped change still links
 *  somewhere even once its pull request has merged and closed. */
function implementingPullRequestOf(
  issue: number,
  pullRequests: readonly { readonly number: number; readonly html_url: string; readonly state: string; readonly body: string | null }[],
): { number: number; url: string } | undefined {
  const candidates = pullRequests.filter((pr) => carriedIssuesOf(pr.body ?? "").includes(issue));
  const pr = candidates.find((candidate) => candidate.state === "open") ?? candidates[0];
  return pr === undefined ? undefined : { number: pr.number, url: pr.html_url };
}

/** One row per failed change, joining {@link computeChangeFailureRate}'s `failed` issue
 *  numbers against issue metadata, each one's implementing pull request, and its earliest
 *  hold/rollback span -- the detail behind the stat tile's headline number, done
 *  server-side so the browser never recomputes anything. */
export function changeFailureEntries(
  failedIssueNumbers: readonly number[],
  issues: readonly { readonly number: number; readonly title: string; readonly html_url: string }[],
  timelines: readonly IssueTimeline[],
  pullRequests: readonly { readonly number: number; readonly html_url: string; readonly state: string; readonly body: string | null }[],
): ChangeFailureEntry[] {
  const issuesByNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const timelinesByIssue = new Map(timelines.map((timeline) => [timeline.issue, timeline]));

  return failedIssueNumbers
    .map((issueNumber): ChangeFailureEntry | undefined => {
      const issue = issuesByNumber.get(issueNumber);
      const timeline = timelinesByIssue.get(issueNumber);
      if (issue === undefined || timeline === undefined) return undefined;
      const span = firstIncidentSpanOf(timeline);
      if (span === undefined) return undefined;
      return {
        issue: issueNumber,
        title: issue.title,
        url: issue.html_url,
        pullRequest: implementingPullRequestOf(issueNumber, pullRequests),
        label: span.label,
        openedAt: span.openedAt,
        closedAt: span.closedAt,
        days: span.days,
      };
    })
    .filter((entry): entry is ChangeFailureEntry => entry !== undefined);
}
