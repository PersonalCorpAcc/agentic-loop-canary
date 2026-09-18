/**
 * MetricValue — display-variant numeric readout with tabular figures.
 *
 * Used wherever an editorial value needs to read like a term-sheet figure
 * (BatchRollups counters, UsagePanel totals, FieldRow extracted value).
 *
 * `emphasis="accent"` lifts the value into the burnished-gold accent for
 * the rare "lead metric" usage; default stays brand ink.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export interface MetricValueProps {
  value: ReactNode;
  unit?: ReactNode;
  emphasis?: "default" | "accent" | "muted";
  size?: "sm" | "md" | "lg";
}

const sizeMap: Record<NonNullable<MetricValueProps["size"]>, string> = {
  sm: "1rem",
  md: "1.25rem",
  lg: "1.5rem",
};

export function MetricValue({
  value,
  unit,
  emphasis = "default",
  size = "md",
}: MetricValueProps) {
  return (
    <Box
      sx={(theme) => ({
        display: "inline-flex",
        alignItems: "baseline",
        gap: 1,
        color:
          emphasis === "accent"
            ? theme.palette.accent.dark
            : emphasis === "muted"
              ? theme.palette.text.secondary
              : theme.palette.text.primary,
        fontFeatureSettings: '"tnum", "onum"',
      })}
    >
      <Typography
        variant="displayMd"
        component="span"
        sx={{
          fontSize: sizeMap[size],
          color: "inherit",
          fontFeatureSettings: 'inherit',
        }}
      >
        {value}
      </Typography>
      {unit ? (
        <Typography variant="eyebrow" component="span" color="text.secondary">
          {unit}
        </Typography>
      ) : null}
    </Box>
  );
}
