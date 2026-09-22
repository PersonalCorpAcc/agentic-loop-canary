import type { LoopRun } from "../shared/types.js";

/**
 * The loop's runs, from the forge.
 *
 * Read-only and unauthenticated where the repository is public, which is what the canary is.
 * A token is used when one is present, because the rate limit without one is 60 requests an
 * hour and this polls.
 *
 * What it cannot do yet: read each run's outcome line. That lives in the job log, which is a
 * second request per run and a zip to unpack, so the first version shows what the run list
 * knows -- route, timing, conclusion -- and an issue tracks the rest.
 */

const repo = process.env["LOOP_REPO"] ?? "PersonalCorpAcc/agentic-loop-canary";
const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";

interface ApiRun {
  readonly id: number;
  readonly name: string;
  readonly display_title: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly html_url: string;
}

/** The route a run's title names, which is how the router titles every run it starts. */
export function routeOf(run: Pick<ApiRun, "name" | "display_title">): string {
  const working = /^Working \(([^)]+)\)/.exec(run.display_title);
  if (working !== null) return working[1]!.toLowerCase().replace(/\s+/g, "-");
  const dispatch = /^dispatch: (\S+)/.exec(run.display_title);
  if (dispatch !== null) return dispatch[1]!;
  return run.name;
}

/** Routes `classify-route` gives a `pr-number` rather than an `issue-number`: the only ones
 *  whose `subject` can name a pull request rather than an issue. */
const pullRequestRoutes = new Set(["merge-gate", "apply-review", "stage-merge", "bot-approve"]);

/** The digits out of a `#25`-shaped subject, or `undefined` for `-` or an issue-only route. */
export function pullRequestNumberOf(run: Pick<LoopRun, "route" | "subject">): number | undefined {
  if (!pullRequestRoutes.has(run.route)) return undefined;
  const match = /^#(\d+)$/.exec(run.subject);
  return match === null ? undefined : Number(match[1]);
}

/** True for a pull request `promote-change` opened: both its shapes, the single-issue
 *  cherry-pick and the multi-issue `env-promotion` snapshot, stamp this marker naming the
 *  stage they promote into. Every other bot pull request -- including an ordinary implement
 *  one, which `link-pr-to-issue` stamps with exactly one `implement-issue` marker of its own
 *  -- has no `promotion-pr` marker and reads false here. */
export function isPromotionPullRequestBody(body: string): boolean {
  return /<!-- promotion-pr: /.test(body);
}

/** Every issue `promote-change` stamps onto a promotion pull request's body, oldest marker
 *  first and each once -- the same grammar `resolve-pr-issue.sh` reads. Meaningful only once
 *  {@link isPromotionPullRequestBody} says the body is a promotion's: an ordinary implement
 *  pull request carries exactly one `implement-issue` marker too, naming the issue it
 *  implements rather than something it carried. */
export function carriedIssuesOf(body: string): number[] {
  const seen = new Set<number>();
  for (const match of body.matchAll(/<!-- implement-issue: (\d+) -->/g)) {
    seen.add(Number(match[1]));
  }
  return [...seen];
}

async function fetchPullRequestBody(number: number): Promise<string | undefined> {
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${number}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) return undefined;
  const body = await response.json() as { body?: string | null };
  return body.body ?? "";
}

export async function listRuns(limit = 50): Promise<LoopRun[]> {
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=${limit}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status}`);

  const body = await response.json() as { workflow_runs?: ApiRun[] };
  const runs = (body.workflow_runs ?? []).map((run): LoopRun => ({
    id: run.id,
    route: routeOf(run),
    // The run list does not carry the loop's own outcome line, so a finished run is described
    // by its conclusion until the log reader exists. `unknown` is honest; inventing `acted`
    // from `success` would not be, because a successful run that decided to do nothing is the
    // single most common thing this loop does.
    outcome: "unknown",
    reason: run.conclusion ?? run.status,
    subject: subjectOf(run.display_title),
    startedAt: run.created_at,
    ...(run.status === "completed" ? { finishedAt: run.updated_at } : {}),
    ...(run.conclusion === null ? {} : { conclusion: run.conclusion }),
    url: run.html_url,
  }));

  // One fetch per distinct pull request rather than per run: several runs -- a merge-gate and
  // the stage-merge that follows it -- can name the same one.
  const numbers = [...new Set(runs.map(pullRequestNumberOf).filter((n) => n !== undefined))];
  const bodies = new Map(
    (await Promise.all(numbers.map(async (n) => [n, await fetchPullRequestBody(n)] as const)))
      .filter(([, body]) => body !== undefined),
  );

  return runs.map((run) => {
    const number = pullRequestNumberOf(run);
    const prBody = number === undefined ? undefined : bodies.get(number);
    // An ordinary pull request -- including one this loop opened to implement an issue -- is
    // left exactly as it was: `carriedIssues` names only a promotion.
    if (prBody === undefined || !isPromotionPullRequestBody(prBody)) return run;
    const carriedIssues = carriedIssuesOf(prBody);
    return carriedIssues.length === 0 ? run : { ...run, carriedIssues };
  });
}

/** `#25` out of a run title, when the title names one. */
export function subjectOf(title: string): string {
  const match = /#(\d+)/.exec(title);
  return match === null ? "-" : `#${match[1]}`;
}
