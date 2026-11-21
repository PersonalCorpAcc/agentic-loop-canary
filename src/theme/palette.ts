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

/**
 * Multi-series chart colour (#149's trend panels -- the first call site that needs more than
 * one line on a chart at once). Neither `brand` nor `status` are usable here: `brand` is a
 * single ink, and `status` is reserved for domain state, read only through `useStatusTone`
 * (Rule 3) -- a route name is not a status. A genuinely new design decision, so it is a
 * semantic slot rather than a literal at the call site (Rule 2 / the component checklist's
 * item 5).
 *
 * The ramp is Okabe & Ito's colour-blind-safe 8-colour set (2008), minus black/white, chosen
 * so adjacent series stay distinguishable under the common forms of colour vision deficiency.
 * `other` is the overflow colour once every ramp colour is in use, applied in `trendChart.ts`
 * rather than hard-coded in a call site.
 */
const chart = {
  categorical: ["#e69f00", "#56b4e9", "#009e73", "#f0e442", "#0072b2", "#d55e00", "#cc79a7"],
  other: "#64748b",
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
  chart,
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

/**
 * Dark-mode tokens for the delivery dashboard shell (#142). The kit ships
 * light-mode only, and `brand.main` does double duty as both ink (nav rail
 * label text, links, the focus ring) and fill (MuiButton/MuiTab/MuiToggleButton
 * selected backgrounds, paired with `brand.contrastText`) — a single hex can't
 * read as light-on-dark ink *and* host dark-on-light fill text at once. The
 * fix is per-palette `brand.contrastText` (already an unused field on
 * `BrandColor`): here `brand.main` is a light ink shade (reused `brand[300]`)
 * and `contrastText` is a dark ink, so `components.ts`'s fills stay correct
 * without needing mode-specific overrides there. Values were chosen against
 * `contrast.ts` for every pairing the shell (nav rail / top bar / page
 * background) actually renders — see the task notes in
 * `openspec/changes/dashboard-shell/`. `status.*` is intentionally left
 * unchanged: it is only ever read through `useStatusTone`, which derives its
 * own tinted background via `alpha()` rather than painting raw status text
 * straight onto a page surface, and status badges are not part of the shell
 * chrome this story scopes (nav rail / top bar / page background).
 */
const darkBrand = {
  ...brand,
  main: brand[300],
  light: brand[400],
  dark: brand[200],
  contrastText: "#0b1220",
};

const darkAccent = {
  ...accent,
  main: accent[300],
  light: accent[200],
  dark: accent[400],
  contrastText: "#0b1220",
  50: "#1c2c40",
  100: "#223448",
};

export const darkPalette: PaletteOptions = {
  mode: "dark",
  primary: darkBrand,
  secondary: darkAccent,
  brand: darkBrand,
  paper: {
    main: "#0b1220",
    ink: "#eef2f7",
    rule: "#243248",
    ruleStrong: "#3b5068",
    muted: "#17233a",
  },
  accent: darkAccent,
  status,
  border: {
    strong: "#3b5068",
  },
  surface: {
    raised: "#111b2e",
    muted: "#17233a",
  },
  chart,
  background: {
    default: "#0b1220",
    paper: "#111b2e",
  },
  text: {
    primary: "#eef2f7",
    secondary: "#a8b6c9",
    disabled: "#7e8da3",
  },
  divider: "#243248",
};
