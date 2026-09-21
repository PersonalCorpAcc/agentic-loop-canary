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
}

/** What the server pushes over the socket as runs begin and end. */
export type LoopEvent =
  | { readonly kind: "snapshot"; readonly runs: readonly LoopRun[]; readonly at: string }
  | { readonly kind: "run"; readonly run: LoopRun; readonly at: string };

export const outcomes: readonly Outcome[] = ["acted", "no-action", "handed-to-human", "failed"];

/** True when the loop asked for a person: the one state a dashboard should surface first. */
export function needsAttention(run: LoopRun): boolean {
  return run.outcome === "handed-to-human" || run.outcome === "failed";
}
