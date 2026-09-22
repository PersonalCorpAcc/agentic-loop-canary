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
export type JobState = "queued" | "running" | "succeeded" | "failed";

export const JOB_STYLES: Record<JobState, StatusStyle> = {
  queued: { tone: "neutral", icon: "•", label: "Queued" },
  running: { tone: "info", icon: "◐", label: "Running" },
  succeeded: { tone: "ok", icon: "✓", label: "Succeeded" },
  failed: { tone: "err", icon: "✕", label: "Failed" },
};

// ---- stage: whether a promotion out of it is frozen ---------------------
export type StageState = "open" | "frozen";

export const STAGE_STYLES: Record<StageState, StatusStyle> = {
  open: { tone: "neutral", icon: "•", label: "Open" },
  frozen: { tone: "err", icon: "✕", label: "Frozen" },
};

export type Kind = "job" | "stage";
export type StateValue = JobState | StageState;

export function styleFor(kind: "job", state: JobState): StatusStyle;
export function styleFor(kind: "stage", state: StageState): StatusStyle;
export function styleFor(kind: Kind, state: StateValue): StatusStyle;
export function styleFor(kind: Kind, state: StateValue): StatusStyle {
  switch (kind) {
    case "job":
      return JOB_STYLES[state as JobState];
    case "stage":
      return STAGE_STYLES[state as StageState];
  }
}
