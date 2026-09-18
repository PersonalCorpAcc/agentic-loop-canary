/**
 * Badge — pure presentational status pill (018 R-07 / T059; US5 chrome T075).
 *
 * Renders a pill from an already-resolved `{ tone, icon, label }`. Has
 * no knowledge of domain entities — the `styleFor` mapper (lib/statusStyles)
 * turns a domain state into these props; `StatusBadge` composes the two.
 *
 * US5 reference chip recipes (`rounded-full px-2.5 py-0.5 text-xs
 * font-semibold`), both variants:
 *   - `filled` (default) — saturated tone fill + white text ("Medium" chip)
 *   - `tinted`           — soft tone tint + tone text + tone border
 *
 * Accessibility (FR-A11Y-01..03, SC-010): colour + icon (shape) + text label —
 * never colour alone. `srLabel` repeats the label for screen readers.
 */
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { JSX } from "react";

import type { Tone } from "@/lib/statusStyles";

import { useStatusTone } from "./useStatusTone";

export interface BadgeProps {
  tone: Tone;
  icon: string;
  label: string;
  /** Chip chrome: saturated `filled` (default) or soft `tinted`. */
  variant?: "filled" | "tinted";
  /** Visually-hidden text for screen readers; defaults to `label`. */
  srLabel?: string;
}

export function Badge({
  tone,
  icon,
  label,
  variant = "filled",
  srLabel,
}: BadgeProps): JSX.Element {
  const theme = useTheme();
  const { color, bg, border } = useStatusTone(tone);
  const chrome =
    variant === "filled"
      ? {
          backgroundColor: color,
          color: theme.palette.common.white,
          border: "1px solid transparent",
        }
      : { backgroundColor: bg, color, border: `1px solid ${border}` };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.5,
        ...chrome,
        borderRadius: "999px",
        px: 2.5,
        py: 0.5,
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Box component="span" aria-hidden sx={{ userSelect: "none" }}>
        {icon}
      </Box>
      <span>{label}</span>
      <span className="sr-only">{srLabel ?? label}</span>
    </Box>
  );
}
