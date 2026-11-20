import type { LoopRun } from "../shared/types.js";
import type { OutcomeLine } from "../shared/outcome-line.js";
import { outcomeOf } from "../shared/outcome-line.js";
import { listRuns } from "./runs.js";

/**
 * One cached snapshot per configured repository, so every dashboard page is a cache read
 * rather than a round trip to the forge.
 *
 * `/api/metrics` only ever reads this cache (see `main.ts`): a scheduled refresh is the only
 * thing that talks to the forge, on `METRICS_REFRESH_SECONDS`, the same pattern
 * `POLL_SECONDS` already uses. A repository the token cannot read fails on its own entry --
 * the rest of the cache is untouched -- and a request arriving mid-refresh reads whatever the
 * previous refresh left, because a refresh only replaces one repository's entry at a time and
 * never clears the map first.
 */

const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";

function headers(): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
  };
}

export interface ApiIssue {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly html_url: string;
  readonly created_at: string;
  readonly labels: readonly (string | { readonly name?: string })[];
}

export interface ApiPullRequest {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly html_url: string;
  readonly merged_at: string | null;
  readonly body: string | null;
  readonly labels: readonly (string | { readonly name?: string })[];
}

export interface ApiLabel {
  readonly name: string;
  readonly color: string;
  readonly description: string | null;
}

/** One entry off an issue's `GET /issues/{n}/timeline`, narrowed to the fields a flow-stage
 *  replay (#161) reads: which event, when, and -- for `labeled` / `unlabeled` -- which
 *  label. Every other event shape the forge returns is passed through untouched. */
export interface TimelineEvent {
  readonly event: string;
  readonly created_at?: string;
  readonly label?: { readonly name?: string };
}

export interface RepoSnapshot {
  readonly repo: string;
  readonly issues: readonly ApiIssue[];
  readonly pullRequests: readonly ApiPullRequest[];
  readonly labels: readonly ApiLabel[];
  readonly runs: readonly LoopRun[];
  readonly issueTimelines: Record<number, readonly TimelineEvent[]>;
}

/** One cache entry: a repository's last successful snapshot, or a failed marker that leaves
 *  every other configured repository's entry alone. */
export interface CachedSnapshot {
  readonly repo: string;
  readonly ok: boolean;
  readonly snapshot?: RepoSnapshot;
  readonly refreshedAt: string;
}

async function listIssues(repo: string): Promise<ApiIssue[]> {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} for ${repo} issues`);
  const body = await response.json() as Array<ApiIssue & { pull_request?: unknown }>;
  // The issues endpoint also returns pull requests; those are read separately below.
  return body.filter((issue) => !("pull_request" in issue));
}

async function listPullRequests(repo: string): Promise<ApiPullRequest[]> {
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls?state=all&per_page=100`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} for ${repo} pull requests`);
  return response.json() as Promise<ApiPullRequest[]>;
}

async function listLabels(repo: string): Promise<ApiLabel[]> {
  const response = await fetch(`https://api.github.com/repos/${repo}/labels?per_page=100`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} for ${repo} labels`);
  return response.json() as Promise<ApiLabel[]>;
}

/** The first job of a run -- the only one the loop's own workflows ever schedule -- or
 *  `undefined` when the forge has nothing to say about it. */
async function firstJobId(repo: string, runId: number): Promise<number | undefined> {
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, {
    headers: headers(),
  });
  if (!response.ok) return undefined;
  const body = await response.json() as { jobs?: Array<{ id: number }> };
  return body.jobs?.[0]?.id;
}

/** A run's own outcome line, read out of its job log. Builds on #30 -- the single-run,
 *  per-session read -- rather than duplicating it. */
async function outcomeLineOf(repo: string, runId: number): Promise<OutcomeLine | undefined> {
  const jobId = await firstJobId(repo, runId);
  if (jobId === undefined) return undefined;
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${jobId}/logs`, {
    headers: headers(),
  });
  if (!response.ok) return undefined;
  return outcomeOf(await response.text());
}

async function runsWithOutcome(repo: string): Promise<LoopRun[]> {
  const runs = await listRuns(50, repo);
  return Promise.all(runs.map(async (run) => {
    const line = await outcomeLineOf(repo, run.id).catch(() => undefined);
    if (line === undefined) return run;
    return {
      ...run,
      outcome: line.outcome === "unknown" ? run.outcome : line.outcome,
      reason: line.reason || run.reason,
      subject: line.subject === "-" ? run.subject : line.subject,
    };
  }));
}

/** One issue's full timeline, oldest first -- drained past the forge's 100-per-page cap
 *  before a flow-stage replay (#161) ever sees it, since a label changed on page 2 is as
 *  real as one on page 1. */
async function fetchIssueTimeline(repo: string, issueNumber: number): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues/${issueNumber}/timeline?per_page=100&page=${page}`,
      { headers: { ...headers(), accept: "application/vnd.github+json" } },
    );
    if (!response.ok) throw new Error(`the forge answered ${response.status} for ${repo}#${issueNumber} timeline`);
    const body = await response.json() as TimelineEvent[];
    events.push(...body);
    if (body.length < 100) break;
  }
  return events;
}

/** Every open or closed issue's timeline, keyed by issue number -- the per-issue label
 *  history a flow-stage replay (#161) needs, fetched alongside the rest of the snapshot so
 *  `/api/flow` never has to make its own forge call. */
async function fetchIssueTimelines(repo: string, issues: readonly ApiIssue[]): Promise<Record<number, readonly TimelineEvent[]>> {
  const entries = await Promise.all(
    issues.map(async (issue) => [issue.number, await fetchIssueTimeline(repo, issue.number)] as const),
  );
  return Object.fromEntries(entries);
}

/** Every piece of one repository's snapshot, fetched fresh. The only function in this module
 *  that talks to the forge for more than a single repository's one resource. */
export async function fetchRepoSnapshot(repo: string): Promise<RepoSnapshot> {
  const [issues, pullRequests, labels, runs] = await Promise.all([
    listIssues(repo),
    listPullRequests(repo),
    listLabels(repo),
    runsWithOutcome(repo),
  ]);
  const issueTimelines = await fetchIssueTimelines(repo, issues);
  return { repo, issues, pullRequests, labels, runs, issueTimelines };
}

export type SnapshotFetcher = (repo: string) => Promise<RepoSnapshot>;

export class MetricsCache {
  private readonly entries = new Map<string, CachedSnapshot>();

  constructor(
    private readonly repos: readonly string[],
    private readonly fetchSnapshot: SnapshotFetcher,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** The cached entry for `repo`, or `undefined` before the first refresh has reached it. A
   *  caller never waits on a refresh in flight: this only ever reads what the map already
   *  holds. */
  get(repo: string): CachedSnapshot | undefined {
    return this.entries.get(repo);
  }

  /** Every configured repository, oldest-first, replaced one at a time as its own fetch
   *  settles -- so a repository already refreshed this round is never re-read waiting on a
   *  slower one, and a failure on one entry never touches another. */
  async refresh(): Promise<void> {
    for (const repo of this.repos) {
      try {
        const snapshot = await this.fetchSnapshot(repo);
        this.entries.set(repo, { repo, ok: true, snapshot, refreshedAt: this.now() });
      } catch {
        this.entries.set(repo, { repo, ok: false, refreshedAt: this.now() });
      }
    }
  }
}
