/**
 * statusStyles — the ADAPTER you rewrite for your own domain.
 *
 * In RiskPoint this maps document/field/run/classification states onto a
 * 5-tone vocabulary. Nothing below is themed: the tone names are the only
 * contract the primitives care about. `useStatusTone` turns a `Tone` into
 * concrete colours; `Badge` renders it; `StatusBadge` is the thin domain
 * adapter you replace.
 *
 * Rules that make this worth keeping as its own module:
 *   1. It is React-free and pure, so it unit-tests without a renderer.
 *   2. Every status ships colour + icon (shape) + text label — never colour
 *      alone. That is what makes the badges accessible (WCAG 1.4.1).
 *   3. `Record<State, StatusStyle>` (not a partial map + fallback) means a
 *      new state is a TYPE ERROR, not a blank badge.
 *
 * Replace `Kind` / `StateValue` / the three maps with your own entities.
 */

export type Tone = "ok" | "warn" | "err" | "info" | "neutral";

export interface StatusStyle {
  tone: Tone;
  icon: string;
  label: string;
}

// ---- EXAMPLE domain (delete and replace) --------------------------------
export type Kind = "job";
export type JobState = "queued" | "running" | "succeeded" | "failed";
export type StateValue = JobState;

export const JOB_STYLES: Record<JobState, StatusStyle> = {
  queued: { tone: "neutral", icon: "•", label: "Queued" },
  running: { tone: "info", icon: "◐", label: "Running" },
  succeeded: { tone: "ok", icon: "✓", label: "Succeeded" },
  failed: { tone: "err", icon: "✕", label: "Failed" },
};

/** Resolve a domain (kind, state) pair to its presentation style. */
export function styleFor(kind: Kind, state: StateValue): StatusStyle {
  switch (kind) {
    case "job":
      return JOB_STYLES[state];
  }
}
