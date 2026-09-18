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
  return (body.workflow_runs ?? []).map((run) => ({
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
}

/** `#25` out of a run title, when the title names one. */
export function subjectOf(title: string): string {
  const match = /#(\d+)/.exec(title);
  return match === null ? "-" : `#${match[1]}`;
}
