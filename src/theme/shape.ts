/**
 * Corner-radius base unit (px) — US5 reference: cards/buttons `rounded-lg`
 * 8px. NOTE: `sx` numeric borderRadius MULTIPLIES by this value (sx
 * `borderRadius: 1` → 8px, `0.75` → 6px `rounded-md`), while styleOverrides
 * in `components.ts` are plain CSS-in-JS (no multiplier — raw px).
 *
 * Radius idioms outside this base unit:
 *   - pill chrome (chips, tabs, icon buttons) uses the literal 999/"999px"
 *   - dialog chrome uses `dialogRadius` below (single knob for MuiDialog)
 */
export const shape = {
  borderRadius: 8,
};

/** Dialog corner radius (px) — consumed by the MuiDialog override (018 T067). */
export const dialogRadius = 8;
