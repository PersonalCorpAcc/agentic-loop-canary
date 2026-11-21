/**
 * TrendChart — a larger inline-SVG line chart with a minimal date axis and
 * a native `<title>` tooltip per point (lead-time-metric 3.2). Same
 * line-drawing approach as `Sparkline` scaled up, plus a hairline X-axis
 * and a handful of evenly spaced date ticks (never one per point). The
 * per-point `<title>` is the accessibility fallback for "value on hover" —
 * it works with no JS and never relies on colour alone.
 */
import { useTheme } from "@mui/material/styles";
import type { JSX } from "react";

import { HelperText } from "@/components/primitives";

export interface TrendChartProps {
  readonly points: readonly { date: string; value: number }[];
  /** The previous period's series, drawn dashed at the same x positions as `points`
   *  (index-aligned, not date-aligned, since the two periods cover different calendar
   *  dates) and scaled against the same y-domain. Ignored when its length differs from
   *  `points`. Purely contextual: no markers, no tooltip. */
  readonly previousPoints?: readonly { date: string; value: number }[];
  readonly height?: number;
  /** Formats a value for the point tooltip. Defaults to `String`. */
  readonly valueLabel?: (value: number) => string;
}

/** Internal SVG coordinate-space width; stretched to the container by the
 *  viewBox (height stays 1:1 with the `height` prop). */
const VIEWBOX_WIDTH = 400;
/** Reserved strip at the bottom for the date-tick text. */
const AXIS_HEIGHT = 24;
const MAX_TICKS = 5;
/** Fraction of the value range reserved as top/bottom breathing room. */
const Y_PADDING_RATIO = 0.12;

/** Evenly spaced indices across `[0, n - 1]`, deduped, at most `count`. */
function pickTickIndices(n: number, count: number): readonly number[] {
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const indices = Array.from({ length: count }, (_, i) =>
    Math.round((i * (n - 1)) / (count - 1)),
  );
  return [...new Set(indices)];
}

export function TrendChart({
  points,
  previousPoints,
  height = 160,
  valueLabel = String,
}: TrendChartProps): JSX.Element {
  const theme = useTheme();

  if (points.length < 2) {
    return <HelperText>not enough data yet</HelperText>;
  }

  const comparablePreviousPoints =
    previousPoints !== undefined && previousPoints.length === points.length ? previousPoints : undefined;

  const plotHeight = height - AXIS_HEIGHT;
  const values = points.map((p) => p.value);
  const previousValues = comparablePreviousPoints?.map((p) => p.value) ?? [];
  const min = Math.min(...values, ...previousValues);
  const max = Math.max(...values, ...previousValues);
  const valueRange = max - min;
  const padding = (valueRange || 1) * Y_PADDING_RATIO;
  const top = max + padding;
  const bottom = min - padding;
  const span = top - bottom || 1;

  const xAt = (i: number): number => (i / (points.length - 1)) * VIEWBOX_WIDTH;
  const yAt = (value: number): number =>
    plotHeight - ((value - bottom) / span) * plotHeight;

  const coords = points.map((p, i) => `${xAt(i)},${yAt(p.value)}`).join(" ");
  const previousCoords = comparablePreviousPoints?.map((p, i) => `${xAt(i)},${yAt(p.value)}`).join(" ");
  const tickIndices = pickTickIndices(points.length, MAX_TICKS);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend chart"
    >
      <line
        x1={0}
        y1={plotHeight}
        x2={VIEWBOX_WIDTH}
        y2={plotHeight}
        stroke={theme.palette.divider}
        strokeWidth={1}
      />
      {previousCoords !== undefined && (
        <polyline
          points={previousCoords}
          fill="none"
          stroke={theme.palette.text.secondary}
          strokeWidth={2}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <polyline
        points={coords}
        fill="none"
        stroke={theme.palette.brand.main}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={p.date}
          cx={xAt(i)}
          cy={yAt(p.value)}
          r={3}
          fill={theme.palette.brand.main}
        >
          <title>{`${p.date}: ${valueLabel(p.value)}`}</title>
        </circle>
      ))}
      {tickIndices.map((i) => {
        const point = points[i];
        if (!point) return null;
        const anchor =
          i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
        return (
          <text
            key={point.date}
            x={xAt(i)}
            y={height - 6}
            fontSize={10}
            textAnchor={anchor}
            fill={theme.palette.text.secondary}
          >
            {point.date}
          </text>
        );
      })}
    </svg>
  );
}
