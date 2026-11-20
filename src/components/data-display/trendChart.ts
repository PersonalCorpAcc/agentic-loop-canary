/**
 * Pure data-shaping for `TrendChart` -- turning a `DailyTrendPoint[]` into the series a chart
 * renders, with no aggregation logic of its own (that stays in `src/shared/trends.ts`, the
 * single counting path).
 *
 * The app's brand/accent/status colors fail a categorical CVD check (they read as grays, or
 * sit below the normal-vision floor adjacent to each other) because they were never chosen as
 * a multi-series set -- they are a one-brand-color-plus-status-tokens palette. This chart
 * primitive therefore carries its own small, validated categorical ramp rather than reusing
 * them, scoped to chart series only.
 */

/** Four hues that clear the categorical CVD/contrast checks pairwise, in the fixed order they
 *  must be assigned (never cycled, never reassigned when a series drops out). A fifth-and-up
 *  series folds into `otherSeriesColor` rather than generating a new hue. */
export const categoricalSeriesColors: readonly string[] = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
];

/** The shared color for every series beyond the first four. */
export const otherSeriesColor = "#64748b";

export interface TrendSeriesPoint {
  readonly day: string;
  readonly value: number;
}

/** The one thing every per-day aggregate point needs to carry for this module to bucket it --
 *  deliberately not `DailyTrendPoint` itself, so this primitive stays app-agnostic the way
 *  `DataTable`'s generic `<R>` does; a caller's real aggregate type (e.g. `src/shared/trends.ts`'s
 *  `DailyTrendPoint`) satisfies this structurally. */
export interface DayPoint {
  readonly day: string;
}

export interface TrendSeries {
  readonly key: string;
  readonly color: string;
  /** Only the days this key actually has a value for -- a day it is absent from contributes
   *  no point here, never a point at zero. */
  readonly points: readonly TrendSeriesPoint[];
}

/** One series per key found in `pick(point)` across `points`, in first-appearance order, each
 *  holding only the days that key's record actually carries a value for. A key with no day at
 *  all produces no series, matching "absent rather than zero" at the series level too. */
export function seriesByKeyOf<T extends DayPoint>(
  points: readonly T[],
  pick: (point: T) => Readonly<Record<string, number>>,
): readonly TrendSeries[] {
  const order: string[] = [];
  const pointsByKey = new Map<string, TrendSeriesPoint[]>();
  for (const point of points) {
    for (const [key, value] of Object.entries(pick(point))) {
      let series = pointsByKey.get(key);
      if (series === undefined) {
        series = [];
        pointsByKey.set(key, series);
        order.push(key);
      }
      series.push({ day: point.day, value });
    }
  }
  return order.map((key, index) => ({
    key,
    color: categoricalSeriesColors[index] ?? otherSeriesColor,
    points: pointsByKey.get(key) ?? [],
  }));
}

/** A single named series from a scalar per day (`successRate`, `shareNeedingAttention`),
 *  skipping any day the accessor returns `undefined` for rather than plotting it as zero. */
export function scalarSeriesOf<T extends DayPoint>(
  points: readonly T[],
  pick: (point: T) => number | undefined,
  key: string,
  color: string,
): TrendSeries {
  const seriesPoints: TrendSeriesPoint[] = [];
  for (const point of points) {
    const value = pick(point);
    if (value !== undefined) seriesPoints.push({ day: point.day, value });
  }
  return { key, color, points: seriesPoints };
}

/** True when there is nothing to plot: no days at all, or every day's record/scalar is empty --
 *  the empty-state trigger, checked before any axis or legend is drawn. */
export function isEmptyTrend(series: readonly TrendSeries[]): boolean {
  return series.every((one) => one.points.length === 0);
}

/** Plain integer counts (run counts, totals). */
export function formatCount(value: number): string {
  return String(Math.round(value));
}

/** A `[0, 1]` share as a whole-number percentage. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Milliseconds as a compact duration: minutes for anything at or above a minute, seconds
 *  below it -- matching how run durations are actually distributed (seconds to tens of
 *  minutes), never hours. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return `${Math.round(totalSeconds / 60)}m`;
}
