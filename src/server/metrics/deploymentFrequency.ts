import { readStageBranches } from "../strategy.js";

/**
 * Deployment frequency: how many changes land on the final stage branch (`main` today, read
 * from `.agentic/profile.yml`'s `branching.chain` via `readStageBranches` rather than
 * hard-coded, so a reprofile changes this with no code edit -- the same approach
 * `src/server/strategy.ts` already takes), bucketed by the UTC calendar day (or week) the
 * stage-arrival label landed.
 *
 * This is the first thing in the app to read an issue's label *timeline* rather than its
 * current-state snapshot (`labelsOf()` in `stages.ts`): under `env-promotion`, one promotion
 * pull request can carry several issues at once, and the only way to know *when* each of
 * them individually arrived -- which is what "changes merged today" means -- is the moment
 * `work-router.yml` stamped that issue's own `merged-{stage}` label, not the promotion
 * pull request's single merge timestamp. The two future children of #139 (lead time,
 * change failure rate / time to restore) reuse this same timeline fetch and arrival
 * classifier rather than re-deriving it.
 */

const repo = process.env["LOOP_REPO"] ?? "PersonalCorpAcc/agentic-loop-canary";
const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";

const MS_PER_DAY = 86_400_000;

export interface LabelEvent {
  readonly event: string;
  readonly created_at: string;
  readonly label?: { readonly name: string };
}

export interface IssueTimeline {
  readonly issue: number;
  readonly events: readonly LabelEvent[];
}

export type Granularity = "day" | "week";

export interface FrequencyBucket {
  readonly bucket: string;
  readonly count: number;
  readonly issues: readonly number[];
}

export type PeriodComparison =
  | { readonly kind: "comparison"; readonly delta: number; readonly percent: number }
  | { readonly kind: "no-prior-data" };

export interface DeploymentFrequencyResult {
  readonly granularity: Granularity;
  readonly buckets: readonly FrequencyBucket[];
  readonly total: number;
  readonly comparison: PeriodComparison;
}

/** The label that marks an issue's change as having arrived on the final stage of the
 *  chain -- `merged-main` today, `merged-{last}` under any other chain. `undefined` only
 *  where the chain itself is empty, which is a config gap this reports as "unknown" rather
 *  than guessing a stage name. */
export function mergedLabelFor(stageBranches: readonly string[]): string | undefined {
  const final = stageBranches.at(-1);
  return final === undefined ? undefined : `merged-${final}`;
}

/** The moment `label` first landed on an issue, read off its own timeline -- the one thing a
 *  current-state snapshot (`labelsOf()`) cannot answer, and the one this metric needs: *when*
 *  each carried issue's own change arrived, not when the promotion pull request that carried
 *  several of them at once was merged. `undefined` where the label never landed. */
export function stageArrivalOf(timeline: IssueTimeline, label: string): string | undefined {
  return timeline.events.find((event) => event.event === "labeled" && event.label?.name === label)?.created_at;
}

/** Daily buckets for a period short enough to show one bar per day ("Last 7/30 days");
 *  weekly once a period would otherwise render more bars than a trend chart can usefully
 *  show ("Last 90 days" would be 90 of them). */
export function granularityFor(periodDays: number): Granularity {
  return periodDays > 30 ? "week" : "day";
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Bucket by the UTC calendar day a timestamp falls on, documented so a reviewer can verify
 *  by hand: a period spanning a bucket boundary mid-day is a UTC-day question, not a local
 *  timezone one, because the forge itself timestamps everything in UTC. Weekly buckets
 *  anchor to the Monday (UTC) of that timestamp's week. */
export function bucketKeyFor(isoTimestamp: string, granularity: Granularity): string {
  const date = new Date(isoTimestamp);
  if (granularity === "day") return dayKey(date);

  const utcMidnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (utcMidnight.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - mondayOffset);
  return dayKey(utcMidnight);
}

/** Every bucket key between `since` and `until` inclusive, so a quiet stretch reads as an
 *  explicit zero rather than a missing point on the chart. */
function bucketsBetween(since: Date, until: Date, granularity: Granularity): string[] {
  const step = granularity === "day" ? MS_PER_DAY : 7 * MS_PER_DAY;
  const firstKey = bucketKeyFor(since.toISOString(), granularity);
  const lastKey = bucketKeyFor(until.toISOString(), granularity);

  const keys: string[] = [];
  let cursor = new Date(`${firstKey}T00:00:00.000Z`);
  const end = new Date(`${lastKey}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(bucketKeyFor(cursor.toISOString(), granularity));
    cursor = new Date(cursor.getTime() + step);
  }
  return keys;
}

/** One entry per bucket across `[since, until]`, zero-filled, each carrying the issue
 *  numbers that landed in it -- a batched promotion carrying several issues counts every one
 *  of them on the day its own `labeled` event landed, not once for the promotion. */
export function computeDeploymentFrequency(
  timelines: readonly IssueTimeline[],
  mergedLabel: string,
  since: Date,
  until: Date,
  granularity: Granularity,
): FrequencyBucket[] {
  const issuesByBucket = new Map<string, number[]>();
  for (const timeline of timelines) {
    const arrival = stageArrivalOf(timeline, mergedLabel);
    if (arrival === undefined) continue;

    const arrivedAt = new Date(arrival).getTime();
    if (arrivedAt < since.getTime() || arrivedAt > until.getTime()) continue;

    const bucket = bucketKeyFor(arrival, granularity);
    const issues = issuesByBucket.get(bucket) ?? [];
    issues.push(timeline.issue);
    issuesByBucket.set(bucket, issues);
  }

  return bucketsBetween(since, until, granularity).map((bucket) => {
    const issues = (issuesByBucket.get(bucket) ?? []).sort((a, b) => a - b);
    return { bucket, count: issues.length, issues };
  });
}

/** Absolute and percentage change against the equal-length previous period -- "no prior
 *  data" rather than a divide-by-zero where that period had no merges at all. */
export function compareToPreviousPeriod(currentTotal: number, previousTotal: number): PeriodComparison {
  if (previousTotal === 0) return { kind: "no-prior-data" };
  return { kind: "comparison", delta: currentTotal - previousTotal, percent: ((currentTotal - previousTotal) / previousTotal) * 100 };
}

/** The number of days a period selector name stands for. */
export function periodDaysFor(period: "7d" | "30d" | "90d"): number {
  return { "7d": 7, "30d": 30, "90d": 90 }[period];
}

interface RawTimelineEvent {
  readonly event?: string;
  readonly created_at?: string;
  readonly label?: { readonly name?: string };
}

async function get<T>(url: string): Promise<T | undefined> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) return undefined;
  return response.json() as Promise<T>;
}

/** An issue's full label timeline, oldest first, paginated the same way the forge paginates
 *  everything else this app reads. */
export async function fetchIssueTimeline(issue: number): Promise<IssueTimeline> {
  const events: LabelEvent[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await get<RawTimelineEvent[]>(
      `https://api.github.com/repos/${repo}/issues/${issue}/events?per_page=100&page=${page}`,
    );
    if (batch === undefined || batch.length === 0) break;

    for (const raw of batch) {
      if (raw.event === undefined || raw.created_at === undefined) continue;
      events.push({
        event: raw.event,
        created_at: raw.created_at,
        ...(raw.label?.name === undefined ? {} : { label: { name: raw.label.name } }),
      });
    }
    if (batch.length < 100) break;
  }
  return { issue, events };
}

/** Every issue (open or closed) currently carrying `label`. */
export async function listIssuesWithLabel(label: string): Promise<number[]> {
  const issues: number[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await get<Array<{ number: number }>>(
      `https://api.github.com/repos/${repo}/issues?state=all&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`,
    );
    if (batch === undefined || batch.length === 0) break;

    issues.push(...batch.map((issue) => issue.number));
    if (batch.length < 100) break;
  }
  return issues;
}

/** The composed read `main.ts` serves: every issue that reached the final stage, bucketed
 *  over the requested period, compared against the equal-length period before it.
 *  `undefined` only where the installed classifier has no chain to read a final stage from. */
export async function loadDeploymentFrequency(
  classifyRoutePath: string,
  periodDays: number,
): Promise<DeploymentFrequencyResult | undefined> {
  const stageBranches = readStageBranches(classifyRoutePath);
  const mergedLabel = stageBranches === undefined ? undefined : mergedLabelFor(stageBranches);
  if (mergedLabel === undefined) return undefined;

  const granularity = granularityFor(periodDays);
  const until = new Date();
  const since = new Date(until.getTime() - periodDays * MS_PER_DAY);
  const previousUntil = since;
  const previousSince = new Date(since.getTime() - periodDays * MS_PER_DAY);

  const issues = await listIssuesWithLabel(mergedLabel);
  const timelines = await Promise.all(issues.map((issue) => fetchIssueTimeline(issue)));

  const buckets = computeDeploymentFrequency(timelines, mergedLabel, since, until, granularity);
  const previousBuckets = computeDeploymentFrequency(timelines, mergedLabel, previousSince, previousUntil, granularity);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const previousTotal = previousBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return { granularity, buckets, total, comparison: compareToPreviousPeriod(total, previousTotal) };
}
