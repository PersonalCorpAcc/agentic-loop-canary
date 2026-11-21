/**
 * TrendChart — a larger inline-SVG line chart with a minimal date axis and a native `<title>`
 * tooltip per point (lead-time-metric 3.2; extended for multi-series + legend in #149). Same
 * line-drawing approach as `Sparkline` scaled up, plus a hairline X-axis and a handful of
 * evenly spaced date ticks (never one per point). The per-point `<title>` is the
 * accessibility fallback for "value on hover" — it works with no JS and never relies on
 * colour alone.
 *
 * Two ways to call it: `points` (the original lead-time call site, one unnamed series, no
 * legend) or `series` (one or more named series, each a legend entry, coloured from
 * `theme.palette.chart` rather than a literal — see `src/theme/palette.ts`). A series' day
 * with no data is never bridged by an interpolated line (`trendChart.ts`'s gap-aware
 * segments); a chart with exactly one point total still renders a lone marker rather than
 * the "not enough data yet" message, which is now reserved for genuinely zero points.
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import type { JSX } from "react";

import { HelperText } from "@/components/primitives";

import { layoutOf, type TrendSeries } from "./trendChart";

export type { TrendPoint, TrendSeries } from "./trendChart";

export interface TrendChartProps {
  /** A single unnamed series (legacy shape) — never shows a legend. */
  readonly points?: readonly { date: string; value: number }[];
  /** One or more named series — a legend entry per series with at least one point. */
  readonly series?: readonly TrendSeries[];
  readonly height?: number;
  /** Formats a value for the point tooltip. Defaults to `String`. */
  readonly valueLabel?: (value: number) => string;
  /** Shown in place of the chart when every series has zero points. */
  readonly emptyLabel?: string;
}

const VIEWBOX_WIDTH = 400;
/** Reserved strip at the bottom for the date-tick text. */
const AXIS_HEIGHT = 24;

export function TrendChart({
  points,
  series,
  height = 160,
  valueLabel = String,
  emptyLabel = "no data for this period",
}: TrendChartProps): JSX.Element {
  const theme = useTheme();
  const showLegend = series !== undefined;
  const resolvedSeries: readonly TrendSeries[] =
    series ?? [{ key: "value", label: "", points: points ?? [] }];

  const plotHeight = height - AXIS_HEIGHT;
  const layout = layoutOf(
    resolvedSeries,
    theme.palette.chart.categorical,
    theme.palette.chart.other,
    { width: VIEWBOX_WIDTH, height: plotHeight },
  );

  if (layout.isEmpty) {
    return <HelperText>{emptyLabel}</HelperText>;
  }

  return (
    <Stack spacing={1}>
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
        {layout.series.map((s) =>
          s.segments.map((segment, segmentIndex) => (
            <polyline
              key={`${s.key}-${segmentIndex}`}
              points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )),
        )}
        {layout.series.map((s) =>
          s.points.map((point) => (
            <circle key={`${s.key}-${point.date}`} cx={point.x} cy={point.y} r={3} fill={s.color}>
              <title>{`${point.date}: ${s.label ? `${s.label} ` : ""}${valueLabel(point.value)}`}</title>
            </circle>
          )),
        )}
        {layout.ticks.map((tick) => (
          <text
            key={tick.date}
            x={tick.x}
            y={height - 6}
            fontSize={10}
            textAnchor={tick.anchor}
            fill={theme.palette.text.secondary}
          >
            {tick.date}
          </text>
        ))}
      </svg>
      {showLegend && layout.legend.length > 0 && (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {layout.legend.map((entry) => (
            <Stack key={entry.key} direction="row" spacing={0.5} alignItems="center">
              <Box
                component="span"
                sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: entry.color, display: "inline-block" }}
              />
              <Typography variant="labelSm" color="text.secondary">
                {entry.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
