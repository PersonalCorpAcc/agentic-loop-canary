/**
 * TrendChart — the Delivery-page chart for a bucketed metric (018 #143): axis
 * labels along the bottom, a native per-point tooltip (exact count + date),
 * no chart library. Renders the same explicit empty state as `Sparkline`
 * instead of a flat zero-line when every bucket is zero. The table linking
 * each change to its issue is a page-level composition next to this chart,
 * not part of it — this component only draws the series.
 */
import { useTheme } from "@mui/material/styles";
import type { JSX, ReactNode } from "react";

import { HelperText } from "../primitives/HelperText";

export interface TrendChartPoint {
  readonly bucket: string;
  readonly value: number;
}

export interface TrendChartProps {
  readonly points: readonly TrendChartPoint[];
  readonly width?: number;
  readonly height?: number;
  readonly emptyMessage?: ReactNode;
  /** How a bucket key renders as its axis label and tooltip date. Defaults to
   *  the key itself — already a UTC `YYYY-MM-DD` from `computeDeploymentFrequency`. */
  readonly formatBucket?: (bucket: string) => string;
}

const PADDING = { top: 16, right: 16, bottom: 28 } as const;

export function TrendChart({
  points,
  width = 480,
  height = 180,
  emptyMessage = "No changes merged in this period",
  formatBucket = (bucket) => bucket,
}: Readonly<TrendChartProps>): JSX.Element {
  const theme = useTheme();
  const total = points.reduce((sum, point) => sum + point.value, 0);

  if (points.length === 0 || total === 0) {
    return <HelperText>{emptyMessage}</HelperText>;
  }

  const plotWidth = width - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const max = Math.max(...points.map((point) => point.value));
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const plotted = points.map((point, index) => ({
    bucket: point.bucket,
    value: point.value,
    x: index * stepX,
    y: PADDING.top + (plotHeight - (point.value / max) * plotHeight),
  }));

  // One label per point up to 8 of them; otherwise thin them out so labels never overlap.
  const labelEvery = Math.max(1, Math.ceil(plotted.length / 8));
  const baseline = PADDING.top + plotHeight;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Trend chart of changes merged per period"
    >
      <line x1={0} y1={baseline} x2={plotWidth} y2={baseline} stroke={theme.palette.divider} strokeWidth={1} />
      <polyline
        points={plotted.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={theme.palette.primary.main}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {plotted.map((point, index) => (
        <g key={point.bucket}>
          <circle cx={point.x} cy={point.y} r={3} fill={theme.palette.primary.main}>
            <title>{`${formatBucket(point.bucket)}: ${point.value}`}</title>
          </circle>
          {index % labelEvery === 0 ? (
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize={10} fill={theme.palette.text.secondary}>
              {formatBucket(point.bucket)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
