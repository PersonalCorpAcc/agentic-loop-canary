/**
 * StatTile — eyebrow label + display-variant value + optional sub-line
 * (018 T062).
 *
 * The label-over-big-number KPI unit behind RunUsageBar's `Metric` and the
 * dashboard `KpiTile` (both weight-500 display values with a sub-line below).
 * `size` covers the per-site value size (22 / 28); `accent` lifts it to the
 * gold highlight.
 *
 * The threshold-coloured accuracy tiles (TierTile / CriticalAccuracyTile) are
 * a deliberately distinct "headline" treatment — mono + weight 700 + an
 * accent eyebrow + an inline target — so they are NOT folded in here; that
 * flattening is a US5 design-language decision, not a mechanical dedup.
 */
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { StackProps } from "@mui/material/Stack";
import type { JSX, ReactNode } from "react";

import { Eyebrow } from "./Eyebrow";

export interface StatTileProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** Value font size in px. Defaults to 22 (the RunUsageBar Metric size). */
  readonly size?: number;
  /** Lift the value into the burnished-gold accent (the "good" highlight). */
  readonly accent?: boolean;
  /** Optional sub-line rendered under the value (already-styled node). */
  readonly sub?: ReactNode;
  /** Root Stack sx passthrough (e.g. minWidth). */
  readonly sx?: StackProps["sx"];
}

export function StatTile({
  label,
  value,
  size = 22,
  accent,
  sub,
  sx,
}: StatTileProps): JSX.Element {
  return (
    <Stack spacing={1} {...(sx ? { sx } : {})}>
      <Eyebrow>{label}</Eyebrow>
      <Typography
        component="span"
        sx={(theme) => ({
          fontFamily: theme.typography.displayMd.fontFamily,
          fontSize: size,
          // US5: reference stat values are `text-2xl font-semibold` — 600.
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          fontFeatureSettings: '"tnum", "onum"',
          color: accent ? theme.palette.accent.dark : theme.palette.text.primary,
        })}
      >
        {value}
      </Typography>
      {sub}
    </Stack>
  );
}
