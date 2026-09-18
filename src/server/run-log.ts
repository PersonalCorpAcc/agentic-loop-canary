import { outcomeOf, type OutcomeLine } from "../shared/outcome-line.js";

/**
 * A completed run's own outcome line, read from its job log.
 *
 * The run list (runs.ts) knows a route, a time and a conclusion, but not what the loop
 * *decided* -- that is written to the log by the job itself (FR-058). A run's log never
 * changes once the run is done, so a completed run's outcome is fetched once and kept for the
 * life of this process; a run still in progress is not fetched, because there is nothing
 * final to read yet.
 */

const repo = process.env["LOOP_REPO"] ?? "PersonalCorpAcc/agentic-loop-canary";
const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";

function headers(): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
  };
}

interface ApiJob {
  readonly id: number;
}

/** The plain-text log of a run's first job -- the outcome line's writer, in this loop. */
async function fetchLog(runId: number): Promise<string> {
  const jobsResponse = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, {
    headers: headers(),
  });
  if (!jobsResponse.ok) throw new Error(`the forge answered ${jobsResponse.status}`);

  const body = await jobsResponse.json() as { jobs?: ApiJob[] };
  const job = (body.jobs ?? [])[0];
  if (job === undefined) throw new Error(`run ${runId} has no job`);

  const logResponse = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`, {
    headers: headers(),
  });
  if (!logResponse.ok) throw new Error(`the forge answered ${logResponse.status}`);
  return await logResponse.text();
}

// Keyed by run id. A run present in this map has been fetched and parsed already, even where
// that parse found nothing -- `has` tells the two cases apart, since a stored value of
// `undefined` is a legitimate "no outcome line in this log".
const cache = new Map<number, OutcomeLine | undefined>();

/**
 * A run's outcome line, fetched at most once and cached for as long as this process runs.
 *
 * A fetch that fails is never cached: the run's log has not been read, so the next poll gets
 * another try rather than being stuck with a transient failure forever.
 */
export async function outcomeFor(runId: number): Promise<OutcomeLine | undefined> {
  if (cache.has(runId)) return cache.get(runId);

  const log = await fetchLog(runId).catch(() => undefined);
  if (log === undefined) return undefined;

  const outcome = outcomeOf(log);
  cache.set(runId, outcome);
  return outcome;
}

/** Test-only: forget every cached run, so a fresh cache boundary can be tested per file. */
export function resetOutcomeCache(): void {
  cache.clear();
}
