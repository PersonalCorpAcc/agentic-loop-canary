import type { Stage, StageBlock } from "../shared/types.js";
import { carriedIssuesOf } from "./runs.js";

/**
 * Whether a stage's merged-but-unpromoted changes are frozen, and by what.
 *
 * Mirrors the gate `promote-change.sh` itself applies under `env-promotion`: a promotion's
 * head is a snapshot of every non-merge commit the stage above is missing, so a `hold`,
 * `rollback` or `hotfix` label on the issue behind any one of them stops the whole snapshot,
 * not just that change (see `promote-change.sh`'s own `blocked=""` loop). This reads the
 * same forge the loop does; it changes nothing.
 */

const repo = process.env["LOOP_REPO"] ?? "PersonalCorpAcc/agentic-loop-canary";
const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";

/** The three labels that stop a promotion, in the order `promote-change.sh` checks them --
 *  the order a change carrying more than one is reported in. */
const BLOCKING_LABELS = ["hold", "rollback", "hotfix"] as const;

/** Which of the three block labels an issue's labels carry, or `undefined` for none. */
export function blockingLabelOf(labels: readonly string[]): string | undefined {
  return BLOCKING_LABELS.find((label) => labels.includes(label));
}

/** The marker `promote-change.sh` stamps on a promotion pull request once a snapshot up to
 *  `sha` has landed on `stage` -- read back so a commit a squash or rebase merge rewrote is
 *  not mistaken for one still waiting (the same check that route makes before opening a
 *  second promotion for content already carried). */
export function promotionSnapshotMarker(stage: string, sha: string): string {
  return `<!-- promotion-snapshot: ${stage}: ${sha} -->`;
}

interface CompareCommit {
  readonly sha: string;
  readonly parents?: readonly { sha: string }[];
}

async function get<T>(path: string): Promise<T | undefined> {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) return undefined;
  return response.json() as Promise<T>;
}

/** Every non-merge commit `previous` has that `next` does not -- the content a snapshot
 *  promotion would carry -- oldest first. */
async function commitsAhead(previous: string, next: string): Promise<CompareCommit[]> {
  const compare = await get<{ commits?: CompareCommit[] }>(`/compare/${next}...${previous}`);
  return (compare?.commits ?? []).filter((commit) => (commit.parents?.length ?? 0) <= 1);
}

/** True when a merged pull request into `next` already carries this snapshot: `next`'s own
 *  history can still show these commits as "ahead" after a squash or rebase merge rewrote
 *  them, and this is the only way to tell that apart from one still waiting. */
async function alreadyPromoted(next: string, sha: string): Promise<boolean> {
  const marker = promotionSnapshotMarker(next, sha);
  const pulls = await get<Array<{ merged_at: string | null; body: string | null }>>(
    `/pulls?state=closed&base=${next}&per_page=50`,
  );
  return (pulls ?? []).some((pull) => pull.merged_at !== null && (pull.body ?? "").includes(marker));
}

/** The issue a commit's own pull request belongs to -- the first pull request the forge
 *  says the commit is on, read the same way a run's `carriedIssues` is (FR-030). */
async function issueOfCommit(sha: string): Promise<number | undefined> {
  const pulls = await get<Array<{ number: number }>>(`/commits/${sha}/pulls`);
  const pull = pulls?.[0];
  if (pull === undefined) return undefined;
  const body = await get<{ body?: string | null }>(`/pulls/${pull.number}`);
  return carriedIssuesOf(body?.body ?? "")[0];
}

async function labelsOf(issue: number): Promise<string[]> {
  const body = await get<{ labels?: Array<string | { name?: string }> }>(`/issues/${issue}`);
  return (body?.labels ?? []).map((label) => (typeof label === "string" ? label : label.name ?? ""));
}

function issueUrl(issue: number): string {
  return `https://github.com/${repo}/issues/${issue}`;
}

/** Every issue stopping a promotion out of `previous` into `next`, oldest first. Empty
 *  when `previous` has nothing to carry, or its snapshot already landed on `next`. */
async function blockedIssuesOf(previous: string, next: string): Promise<StageBlock[]> {
  const commits = await commitsAhead(previous, next);
  if (commits.length === 0) return [];

  const tip = commits[commits.length - 1]!.sha;
  if (await alreadyPromoted(next, tip)) return [];

  const issues = new Set<number>();
  for (const commit of commits) {
    const issue = await issueOfCommit(commit.sha);
    if (issue !== undefined) issues.add(issue);
  }

  const blocked: StageBlock[] = [];
  for (const issue of issues) {
    const label = blockingLabelOf(await labelsOf(issue));
    if (label !== undefined) blocked.push({ issue, label, url: issueUrl(issue) });
  }
  return blocked;
}

/** Every stage in the chain, in order, with whichever of them a hold, rollback or hotfix
 *  label is currently freezing. The last stage has nothing to promote out of, so it is
 *  never frozen. */
export async function listStages(stageBranches: readonly string[]): Promise<Stage[]> {
  const stages: Stage[] = [];
  for (let index = 0; index < stageBranches.length; index += 1) {
    const name = stageBranches[index]!;
    const next = stageBranches[index + 1];
    const blockedBy = next === undefined ? [] : await blockedIssuesOf(name, next);
    stages.push({ name, frozen: blockedBy.length > 0, blockedBy });
  }
  return stages;
}
