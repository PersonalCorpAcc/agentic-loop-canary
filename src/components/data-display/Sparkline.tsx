/**
 * Sparkline — a tiny inline SVG line, no chart library (018 #143): the shape
 * for a `StatTile.sub` slot, not a chart in its own right. Renders an
 * explicit empty state rather than a flat zero-line when every bucket is
 * zero, so "nothing shipped this period" never reads as "broken".
 */
import { useTheme } from "@mui/material/styles";
import type { JSX, ReactNode } from "react";

import { HelperText } from "../primitives/HelperText";

export interface SparklinePoint {
  readonly bucket: string;
  readonly value: number;
}

export interface SparklineProps {
  readonly points: readonly SparklinePoint[];
  readonly width?: number;
  readonly height?: number;
  readonly emptyMessage?: ReactNode;
}

export function Sparkline({
  points,
  width = 96,
  height = 24,
  emptyMessage = "No changes merged in this period",
}: Readonly<SparklineProps>): JSX.Element {
  const theme = useTheme();
  const total = points.reduce((sum, point) => sum + point.value, 0);

  if (points.length === 0 || total === 0) {
    return <HelperText inline>{emptyMessage}</HelperText>;
  }

  const max = Math.max(...points.map((point) => point.value));
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points
    .map((point, index) => `${index * stepX},${height - (point.value / max) * height}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Sparkline of changes merged per period"
    >
      <polyline
        points={coords}
        fill="none"
        stroke={theme.palette.primary.main}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
