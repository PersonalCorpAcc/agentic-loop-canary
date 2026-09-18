import type { LoopRun, Outcome } from "./types.js";

/**
 * The loop's own outcome line, parsed.
 *
 * Every deterministic job and every worker ends by writing one line (FR-058):
 *
 *   outcome=acted route=merge-gate subject=#25 reason=merge-armed -- The pull request is ...
 *
 * It is machine-readable first and human-readable second, which is exactly what a dashboard
 * needs: the four fields decide the colour and the sentence after `--` is the caption. This
 * parser is deliberately tolerant about the tail and strict about the fields, because a run
 * whose detail we cannot read is still a run worth showing.
 */

const knownOutcomes = new Set<string>(["acted", "no-action", "handed-to-human", "failed"]);

export interface OutcomeLine {
  readonly outcome: Outcome | "unknown";
  readonly route: string;
  readonly subject: string;
  readonly reason: string;
  readonly detail?: string;
}

export function parseOutcomeLine(line: string): OutcomeLine | undefined {
  const fields = new Map<string, string>();
  // `key=value` pairs up to the `--`, values never containing a space: the writer builds the
  // line that way, and taking the tail whole means a detail with an `=` in it cannot confuse
  // the fields.
  const [head, ...rest] = line.split(" -- ");
  for (const match of (head ?? "").matchAll(/(\w+)=([^\s]*)/g)) {
    fields.set(match[1]!, match[2]!);
  }

  const outcome = fields.get("outcome");
  const route = fields.get("route");
  if (outcome === undefined || route === undefined) return undefined;

  return {
    outcome: knownOutcomes.has(outcome) ? outcome as Outcome : "unknown",
    route,
    subject: fields.get("subject") ?? "-",
    reason: fields.get("reason") ?? "",
    ...(rest.length > 0 ? { detail: rest.join(" -- ") } : {}),
  };
}

/** The first outcome line in a log, which is the one the job wrote for itself. */
export function outcomeOf(log: string): OutcomeLine | undefined {
  for (const line of log.split("\n")) {
    const parsed = parseOutcomeLine(line);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

/** A run and its outcome, joined, for the views that show both. */
export function describe(run: LoopRun): string {
  const subject = run.subject === "-" ? "" : ` ${run.subject}`;
  return `${run.route}${subject}: ${run.reason || run.outcome}`;
}
