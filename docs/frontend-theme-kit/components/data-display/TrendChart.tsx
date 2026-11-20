import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState, type JSX } from "react";

import { formatCount, isEmptyTrend, type TrendSeries } from "./trendChart.js";

/**
 * The first trend-chart primitive: a day-by-day line chart with an axis on each side, a
 * tooltip reachable by hover or keyboard focus, a legend when more than one series is plotted,
 * and an empty state when there is nothing to show.
 *
 * Takes pre-shaped `series` (see `trendChart.ts`'s `seriesByKeyOf`/`scalarSeriesOf`) rather
 * than raw `DailyTrendPoint[]`, so this component has no aggregation or day-bucketing logic of
 * its own -- a day a series has no value for is simply not drawn for that series (no
 * interpolation, no zero point), matching the "absent rather than zero" rule the underlying
 * aggregation already follows.
 */

const WIDTH = 480;
const HEIGHT = 160;
const PADDING_LEFT = 36;
const PADDING_RIGHT = 8;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 20;

export interface TrendChartProps {
  readonly title: string;
  /** The period's full, ordered day keys (`YYYY-MM-DD`) -- the x-axis domain, independent of
   *  which series have a value on which day. */
  readonly days: readonly string[];
  readonly series: readonly TrendSeries[];
  /** Formats a y-value and a tooltip value; defaults to a plain rounded count. */
  readonly formatValue?: (value: number) => string;
  readonly emptyMessage?: string;
}

export function TrendChart({
  title,
  days,
  series,
  formatValue = formatCount,
  emptyMessage = "No data for this period.",
}: TrendChartProps): JSX.Element {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  if (days.length === 0 || isEmptyTrend(series)) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const maxValue = Math.max(1, ...series.flatMap((one) => one.points.map((point) => point.value)));

  const xOf = (index: number): number =>
    days.length === 1
      ? PADDING_LEFT + plotWidth / 2
      : PADDING_LEFT + (index / (days.length - 1)) * plotWidth;
  const yOf = (value: number): number =>
    PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;

  const seriesWithPixels = series.map((one) => ({
    ...one,
    pixels: one.points
      .map((point) => {
        const index = dayIndex.get(point.day);
        return index === undefined ? null : { index, x: xOf(index), y: yOf(point.value), value: point.value };
      })
      .filter((pixel): pixel is { index: number; x: number; y: number; value: number } => pixel !== null)
      .sort((a, b) => a.index - b.index),
  }));

  const hovered = hoveredDay === null ? null : {
    day: days[hoveredDay]!,
    x: xOf(hoveredDay),
    entries: seriesWithPixels.flatMap((one) => {
      const pixel = one.pixels.find((p) => p.index === hoveredDay);
      return pixel === undefined ? [] : [{ key: one.key, color: one.color, value: pixel.value }];
    }),
  };

  return (
    <Box sx={{ position: "relative" }}>
      <Typography variant="subtitle2">{title}</Typography>
      <Box sx={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label={title}
        >
          <line
            x1={PADDING_LEFT} y1={PADDING_TOP + plotHeight}
            x2={WIDTH - PADDING_RIGHT} y2={PADDING_TOP + plotHeight}
            stroke="#e2e8f0" strokeWidth={1}
          />
          <line
            x1={PADDING_LEFT} y1={PADDING_TOP}
            x2={PADDING_LEFT} y2={PADDING_TOP + plotHeight}
            stroke="#e2e8f0" strokeWidth={1}
          />
          <text x={PADDING_LEFT - 6} y={PADDING_TOP + plotHeight} fontSize={9} fill="#64748b" textAnchor="end">0</text>
          <text x={PADDING_LEFT - 6} y={PADDING_TOP + 8} fontSize={9} fill="#64748b" textAnchor="end">
            {formatValue(maxValue)}
          </text>
          <text x={PADDING_LEFT} y={HEIGHT - 4} fontSize={9} fill="#64748b" textAnchor="start">{days[0]}</text>
          <text x={WIDTH - PADDING_RIGHT} y={HEIGHT - 4} fontSize={9} fill="#64748b" textAnchor="end">
            {days[days.length - 1]}
          </text>

          {seriesWithPixels.map((one) => (
            <g key={one.key}>
              {one.pixels.slice(1).map((point, i) => {
                const prev = one.pixels[i]!;
                return prev.index === point.index - 1 ? (
                  <line
                    key={point.index}
                    x1={prev.x} y1={prev.y} x2={point.x} y2={point.y}
                    stroke={one.color} strokeWidth={2} strokeLinecap="round"
                  />
                ) : null;
              })}
              {one.pixels.map((point) => (
                <circle
                  key={point.index}
                  cx={point.x} cy={point.y} r={4}
                  fill={one.color} stroke="#ffffff" strokeWidth={2}
                >
                  <title>{`${one.key}: ${formatValue(point.value)} on ${days[point.index]}`}</title>
                </circle>
              ))}
            </g>
          ))}

          {hovered !== null && (
            <line
              x1={hovered.x} y1={PADDING_TOP} x2={hovered.x} y2={PADDING_TOP + plotHeight}
              stroke="#94a3b8" strokeWidth={1}
            />
          )}

          {days.map((day, index) => (
            <rect
              key={day}
              x={xOf(index) - plotWidth / Math.max(1, days.length - 1) / 2}
              y={PADDING_TOP}
              width={days.length === 1 ? plotWidth : plotWidth / (days.length - 1)}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${day}: ${seriesWithPixels
                .flatMap((one) => {
                  const pixel = one.pixels.find((p) => p.index === index);
                  return pixel === undefined ? [] : [`${one.key} ${formatValue(pixel.value)}`];
                })
                .join(", ") || "no data"}`}
              onMouseEnter={() => setHoveredDay(index)}
              onMouseLeave={() => setHoveredDay(null)}
              onFocus={() => setHoveredDay(index)}
              onBlur={() => setHoveredDay(null)}
            />
          ))}
        </svg>

        {hovered !== null && hovered.entries.length > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: PADDING_TOP,
              left: `${(hovered.x / WIDTH) * 100}%`,
              transform: "translate(-50%, 0)",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 1,
              pointerEvents: "none",
              boxShadow: 1,
              zIndex: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">{hovered.day}</Typography>
            {hovered.entries.map((entry) => (
              <Stack key={entry.key} direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 8, height: 2, bgcolor: entry.color }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {formatValue(entry.value)}
                </Typography>
                <Typography variant="caption" color="text.secondary">{entry.key}</Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>

      {series.length > 1 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
          {series.map((one) => (
            <Stack key={one.key} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 10, height: 2, bgcolor: one.color }} />
              <Typography variant="caption" color="text.secondary">{one.key}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
