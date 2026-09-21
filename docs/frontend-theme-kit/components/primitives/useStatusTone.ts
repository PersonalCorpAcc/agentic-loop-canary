/**
 * useStatusTone — the sanctioned outlet for `theme.palette.status.*` (018 R-07 / T059).
 *
 * Turns a semantic `Tone` into concrete chrome: `color` (the base semantic
 * colour for text, bar fills, borders), plus `bg` / `border` for pill chrome.
 * This hook is a whitelisted `palette.status` consumer (alongside the status
 * primitives) — every raw colour need (DataGrid cell text, composition bars,
 * threshold colouring) routes through it instead of reaching into the palette
 * directly. The tone→chrome values are byte-identical to the former private
 * `useToneStyle` inside StatusBadge, so consumers render unchanged.
 */
import { alpha, useTheme, type Theme } from "@mui/material/styles";

import type { Tone } from "@/lib/statusStyles";

export interface StatusToneStyle {
  /** Base semantic colour — text, bar fills, borders. */
  color: string;
  /** Soft tinted background for pill/chip chrome. */
  bg: string;
  /** Border colour for pill/chip chrome. */
  border: string;
}

/**
 * Resolve a tone to (color, bg, border) using palette.status tokens.
 * `neutral` falls back to paper chrome so it reads as "no signal".
 */
function resolveTone(theme: Theme, tone: Tone): StatusToneStyle {
  const s = theme.palette.status;
  switch (tone) {
    case "ok":
      return { color: s.ok, bg: alpha(s.ok, 0.12), border: alpha(s.ok, 0.4) };
    case "warn":
      return { color: s.warn, bg: alpha(s.warn, 0.12), border: alpha(s.warn, 0.4) };
    case "err":
      return { color: s.err, bg: alpha(s.err, 0.12), border: alpha(s.err, 0.4) };
    case "info":
      return { color: s.info, bg: alpha(s.info, 0.1), border: alpha(s.info, 0.35) };
    case "neutral":
      return {
        color: s.neutral,
        bg: theme.palette.paper.muted,
        border: theme.palette.border.strong,
      };
  }
}

const TONES: readonly Tone[] = ["ok", "warn", "err", "info", "neutral"];

/** Resolve a single tone's chrome. */
export function useStatusTone(tone: Tone): StatusToneStyle {
  const theme = useTheme();
  return resolveTone(theme, tone);
}

/**
 * Resolve every tone's chrome in one call — for components that colour by more
 * than one tone (composition bars, threshold text) and would otherwise call the
 * hook conditionally or in a loop.
 */
export function useStatusTones(): Record<Tone, StatusToneStyle> {
  const theme = useTheme();
  return Object.fromEntries(
    TONES.map((t) => [t, resolveTone(theme, t)]),
  ) as Record<Tone, StatusToneStyle>;
}
