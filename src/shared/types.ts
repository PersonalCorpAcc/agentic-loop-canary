/**
 * The vocabulary both halves share.
 *
 * Every one of these mirrors something the loop already writes, rather than something this
 * application invents: a run's outcome line is `outcome=... route=... subject=... reason=...`
 * (FR-058), and the enumerations below are the ones the loop's own `record-outcome` holds. If
 * a value arrives that is not in them, that is a real event worth showing rather than a
 * parsing failure to hide, which is why `reason` is a plain string.
 */

export type Outcome = "acted" | "no-action" | "handed-to-human" | "failed";

export interface LoopRun {
  readonly id: number;
  /** The route the router classified the event as: implement, merge-gate, promote, ... */
  readonly route: string;
  readonly outcome: Outcome | "unknown";
  /** From the closed enumeration in record-outcome.sh, or whatever a newer loop wrote. */
  readonly reason: string;
  /** `#12` for a pull request or issue, `-` where the route has no subject. */
  readonly subject: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly conclusion?: string;
  readonly url: string;
  /**
   * Under `env-promotion` a promotion pull request's head is a snapshot of the stage below,
   * so it carries every issue that landed there since the last promotion, not just one. When
   * `subject` names such a pull request, this is every issue its body marks with
   * `<!-- implement-issue: N -->`, oldest first. Absent for a run whose subject is not a
   * promotion pull request, so an ordinary row is unchanged.
   */
  readonly carriedIssues?: readonly number[];
}

/** One issue that stops a stage's next promotion, and the label it carries. */
export interface StageBlock {
  readonly issue: number;
  readonly label: string;
  readonly url: string;
}

/**
 * One stage of the installed branching strategy's chain.
 *
 * Under `env-promotion` a promotion carries every merged change on a stage as one
 * all-or-nothing snapshot, so a `hold`, `rollback` or `hotfix` label on any one of them
 * stops every promotion out of that stage, not just the change it is on. `blockedBy` names
 * every issue currently doing that; a stage with none is not frozen, and the last stage in
 * the chain -- which nothing promotes out of -- is never frozen.
 */
export interface Stage {
  readonly name: string;
  readonly frozen: boolean;
  readonly blockedBy: readonly StageBlock[];
}

/** What the server pushes over the socket as runs begin and end. */
export type LoopEvent =
  | { readonly kind: "snapshot"; readonly runs: readonly LoopRun[]; readonly at?: string }
  | { readonly kind: "run"; readonly run: LoopRun; readonly at?: string };

export const outcomes: readonly Outcome[] = ["acted", "no-action", "handed-to-human", "failed"];

/** True when the loop asked for a person: the one state a dashboard should surface first. */
export function needsAttention(run: LoopRun): boolean {
  return run.outcome === "handed-to-human" || run.outcome === "failed";
}
