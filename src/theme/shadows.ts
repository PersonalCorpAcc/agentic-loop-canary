import type { Shadows } from "@mui/material/styles";

/**
 * US5 reference shadow ramp (018 T073) — flat, document-first:
 *   1      → `shadow-sm`  (cards; `0 1px 2px rgba(0,0,0,.05)`)
 *   2      → `shadow-lg`  (popovers, dialogs)
 *   3..24  → `shadow-2xl` (drawers / slide-overs; reference reserves the
 *            heavy shadow for overlay chrome only)
 * Position 0 is unused per MUI.
 */
const sm = "0 1px 2px 0 rgba(0,0,0,0.05)";
const lg = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)";
const xxl = "0 25px 50px -12px rgba(0,0,0,0.25)";

export const shadows: Shadows = [
  "none",
  sm,
  lg,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
  xxl,
] as Shadows;
