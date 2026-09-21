import type { PaletteOptions } from "@mui/material/styles";

/**
 * RiskPoint palette — US5 design language (018 T072), values taken exactly
 * from `specs/018-frontend-refactor/design-reference.md` (compiled CSS of the
 * reference app checked in at `assets/reference-compiled.css`).
 *
 * brand   — deep navy-teal ink: fills, active nav, primary buttons
 * paper   — app chrome: putty background + slate border/tint neutrals
 * accent  — sage ramp (gold is retired; the logo confirms ink + sage only)
 * status  — six semantic tokens; consumed ONLY via the status primitives
 *
 * Semantic layer (FR-024) — the slots call sites address instead of raw
 * ramp shades; US5 flipped them to the reference slate ladder:
 *   text.secondary — muted text (slate-500)
 *   divider        — hairline rules/borders (slate-200)
 *   border.strong  — emphasised/control borders (slate-300)
 *   surface.raised — raised card surface (white)
 *   surface.muted  — recessed panel / table-header fill (slate-50)
 */

const brand = {
  main: "#122933",
  light: "#94a3b8",
  dark: "#1c3a49",
  contrastText: "#ffffff",
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#94a3b8",
  400: "#64748b",
  500: "#334155",
  600: "#122933",
  700: "#0b1b22",
};

const paper = {
  main: "#eceee5",
  ink: "#0f172a",
  rule: "#e2e8f0",
  ruleStrong: "#cbd5e1",
  muted: "#f1f5f9",
};

const accent = {
  main: "#a1a67c",
  light: "#cbcfae",
  dark: "#4d5039",
  contrastText: "#ffffff",
  50: "#f5f6ef",
  100: "#eceee0",
  200: "#eceee0",
  300: "#cbcfae",
  400: "#a1a67c",
  500: "#a1a67c",
  600: "#4d5039",
};

const status = {
  ok: "#16a34a",
  warn: "#d97706",
  err: "#dc2626",
  info: "#1c3a49",
  neutral: "#64748b",
  // A sixth slot, conflict: "#b45309", was here for the `conflict`
  // classification. Migration 050 removed that mark; the slot had already
  // stopped being read (the mark rendered with `err`).
};

export const palette: PaletteOptions = {
  mode: "light",
  primary: brand,
  secondary: accent,
  brand,
  paper,
  accent,
  status,
  border: {
    strong: paper.ruleStrong,
  },
  surface: {
    raised: "#ffffff",
    muted: "#f8fafc",
  },
  background: {
    default: paper.main,
    paper: "#ffffff",
  },
  text: {
    primary: "#0f172a",
    secondary: "#64748b",
    disabled: "#94a3b8",
  },
  divider: paper.rule,
};
