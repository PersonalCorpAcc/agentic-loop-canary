import type { Stage, StageBlock, StageSoak } from "../shared/types.js";
import { reposOf } from "./repos.js";
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

const repo = reposOf()[0]!;
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

/** When the pull request that produced `sha` merged, the same way `promote-change.sh`'s
 *  `promote_by_snapshot` times a soak -- against the merge, not the commit's own date, since
 *  a cherry-pick or rebase can carry an older commit date forward. `undefined` when no merged
 *  pull request is on record for it. */
async function mergedAtOf(sha: string): Promise<string | undefined> {
  const pulls = await get<Array<{ merged_at?: string | null }>>(`/commits/${sha}/pulls`);
  return pulls?.[0]?.merged_at ?? undefined;
}

/** `max(0, floor(soakSeconds - elapsed))`, so a soak already past its duration floors to
 *  zero rather than counting into negative time. */
export function remainingSoakSeconds(soakSeconds: number, mergedAt: string, now: number): number {
  const elapsedSeconds = (now - Date.parse(mergedAt)) / 1000;
  return Math.max(0, Math.floor(soakSeconds - elapsedSeconds));
}

interface Pending {
  /** Every issue currently merged onto the stage and not yet promoted past it. */
  readonly items: readonly { issue: number; url: string }[];
  /** Of those, the ones carrying a hold, rollback or hotfix label. */
  readonly blockedBy: readonly StageBlock[];
  /** The newest ahead commit's sha, for soak timing -- `undefined` when nothing is pending. */
  readonly tip: string | undefined;
}

/** Everything pending a promotion out of `previous` into `next`: its items, which of them
 *  are blocking, and the commit a soak is timed against. Empty/`undefined` when `previous`
 *  has nothing to carry, or its snapshot already landed on `next`. */
async function pendingOf(previous: string, next: string): Promise<Pending> {
  const commits = await commitsAhead(previous, next);
  if (commits.length === 0) return { items: [], blockedBy: [], tip: undefined };

  const tip = commits[commits.length - 1]!.sha;
  if (await alreadyPromoted(next, tip)) return { items: [], blockedBy: [], tip: undefined };

  const issues = new Set<number>();
  for (const commit of commits) {
    const issue = await issueOfCommit(commit.sha);
    if (issue !== undefined) issues.add(issue);
  }

  const items = [...issues].map((issue) => ({ issue, url: issueUrl(issue) }));
  const blockedBy: StageBlock[] = [];
  for (const issue of issues) {
    const label = blockingLabelOf(await labelsOf(issue));
    if (label !== undefined) blockedBy.push({ issue, label, url: issueUrl(issue) });
  }
  return { items, blockedBy, tip };
}

/** Every stage in the chain, in order: whichever of them a hold, rollback or hotfix label is
 *  currently freezing, every issue merged onto it and waiting to promote onward, and --
 *  where `soakSeconds` (from `soakOf`) names a duration for the next stage, the stage is not
 *  frozen, and a merge timestamp can be read -- how long remains before its newest pending
 *  change can promote. The last stage has nothing to promote out of, so it is never frozen
 *  and never soaking. */
export async function listStages(
  stageBranches: readonly string[],
  soakSeconds?: Record<string, number>,
): Promise<Stage[]> {
  const stages: Stage[] = [];
  for (let index = 0; index < stageBranches.length; index += 1) {
    const name = stageBranches[index]!;
    const next = stageBranches[index + 1];
    if (next === undefined) {
      stages.push({ name, frozen: false, blockedBy: [], items: [] });
      continue;
    }

    const { items, blockedBy, tip } = await pendingOf(name, next);
    const frozen = blockedBy.length > 0;

    let soak: StageSoak | undefined;
    const duration = soakSeconds?.[next];
    if (!frozen && tip !== undefined && duration !== undefined) {
      const mergedAt = await mergedAtOf(tip);
      if (mergedAt !== undefined) {
        const remainingSeconds = remainingSoakSeconds(duration, mergedAt, Date.now());
        soak = { remainingSeconds, completesAt: new Date(Date.now() + remainingSeconds * 1000).toISOString() };
      }
    }

    stages.push({ name, frozen, blockedBy, items, ...(soak === undefined ? {} : { soak }) });
  }
  return stages;
}
