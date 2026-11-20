/**
 * Sparkline — a minimal inline-SVG trend line, no axes/labels/legend
 * (lead-time-metric 3.1; `StatTile`'s `sub` slot is its intended home).
 *
 * `points` are normalised independently on each axis: X spreads evenly
 * across `width`, Y maps the series' own min/max into `height` with a
 * little padding so the line never clips flush against the top/bottom
 * edge (and a flat series still draws as a flat line, not a div-by-zero).
 */
import { useTheme } from "@mui/material/styles";
import type { JSX } from "react";

import { HelperText } from "@/components/primitives";

export interface SparklineProps {
  readonly points: readonly number[];
  readonly width?: number;
  readonly height?: number;
}

/** Fraction of the value range reserved as top/bottom breathing room. */
const Y_PADDING_RATIO = 0.1;

export function Sparkline({
  points,
  width = 80,
  height = 24,
}: SparklineProps): JSX.Element {
  const theme = useTheme();

  if (points.length < 2) {
    return <HelperText inline>not enough data yet</HelperText>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const valueRange = max - min;
  const padding = (valueRange || 1) * Y_PADDING_RATIO;
  const top = max + padding;
  const bottom = min - padding;
  const span = top - bottom || 1;

  const coords = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((value - bottom) / span) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Trend sparkline"
    >
      <polyline
        points={coords}
        fill="none"
        stroke={theme.palette.brand.main}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
