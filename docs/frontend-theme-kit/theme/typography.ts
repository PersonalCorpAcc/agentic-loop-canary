import type { TypographyVariantsOptions } from "@mui/material/styles";

const sans =
  '"Montserrat", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const mono =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Typography — US5 design language (018 T074), from design-reference.md.
 *
 * Family is Montserrat ONLY (400/500/600/700) — the editorial serif face is
 * retired; the reference loads none. `mono` (JetBrains Mono) is retained for
 * numeric/code readouts per the confirmed design assumption.
 *
 * Custom variants:
 *   - displayXl / displayLg / displayMd → 40/32/24 px, 600, tracking-tight
 *   - eyebrow                            → 10px / 600 / uppercase / tracking-micro
 *   - mono                               → JetBrains Mono (tabular figures)
 *   - labelSm                            → 12px label/caption tier (`text-xs`)
 *   - tableCell                          → 14px data-row tier (`text-sm`)
 */
export const typography: TypographyVariantsOptions = {
  fontFamily: sans,
  fontSize: 14,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,

  h1: {
    fontFamily: sans,
    fontSize: "40px",
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
    fontWeight: 600,
  },
  h2: {
    fontFamily: sans,
    fontSize: "32px",
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
    fontWeight: 600,
  },
  h3: {
    fontFamily: sans,
    fontSize: "24px",
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
    fontWeight: 600,
  },
  body1: { fontSize: "0.875rem", lineHeight: 1.5 },
  body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
  button: {
    fontFamily: sans,
    textTransform: "none",
    fontWeight: 600,
    letterSpacing: "0.01em",
  },

  // Custom variants (declared via module augmentation in `module-augmentation.ts`).
  displayXl: {
    fontFamily: sans,
    fontSize: "40px",
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
    fontWeight: 600,
  },
  displayLg: {
    fontFamily: sans,
    fontSize: "32px",
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
    fontWeight: 600,
  },
  displayMd: {
    fontFamily: sans,
    fontSize: "24px",
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
    fontWeight: 600,
  },
  // US5: the reference uses NO all-caps anywhere — "eyebrow" is now the
  // stat-card/section label tier (`text-xs font-medium`), normal case.
  eyebrow: {
    fontFamily: sans,
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: 0,
    textTransform: "none",
    lineHeight: 1.4,
  },
  mono: {
    fontFamily: mono,
    fontSize: "0.8125rem",
    lineHeight: 1.5,
  },
  // US5 tiers (018 T069 introduced these pixel-matched to the old sprawl;
  // US5 flips them to the reference sizes: labels 12px, data rows 14px).
  labelSm: {
    fontFamily: sans,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.00938em",
  },
  tableCell: {
    fontFamily: sans,
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.00938em",
  },
};

export const typographyFamilies = { sans, mono };
