/**
 * Pure (non-React) layout logic for `TrendChart` (#149) -- the x/y coordinate maths, tick
 * selection, per-series colour assignment, legend entries and line-segment splitting, kept
 * out of the SVG component so it is unit-testable without a DOM.
 *
 * A series' missing day is never bridged by an interpolated line: points are split into
 * contiguous runs along the shared date domain, and only a run of two or more points ever
 * becomes a drawn line -- a single isolated point renders as a lone marker instead.
 */

export interface TrendPoint {
  readonly date: string;
  readonly value: number;
}

export interface TrendSeries {
  readonly key: string;
  readonly label: string;
  readonly points: readonly TrendPoint[];
}

export interface PositionedPoint extends TrendPoint {
  readonly x: number;
  readonly y: number;
}

export interface PositionedSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly points: readonly PositionedPoint[];
  /** Contiguous runs of two or more points, each drawn as its own polyline. */
  readonly segments: readonly (readonly PositionedPoint[])[];
}

export interface LegendEntry {
  readonly key: string;
  readonly label: string;
  readonly color: string;
}

export interface AxisTick {
  readonly date: string;
  readonly x: number;
  readonly anchor: "start" | "middle" | "end";
}

export interface TrendLayout {
  /** Every distinct date across all series, ascending -- the chart's shared x domain. */
  readonly domain: readonly string[];
  readonly series: readonly PositionedSeries[];
  readonly ticks: readonly AxisTick[];
  readonly legend: readonly LegendEntry[];
  /** True only when every series has zero points; a single point still renders. */
  readonly isEmpty: boolean;
}

export interface LayoutOptions {
  readonly width: number;
  readonly height: number;
  readonly maxTicks?: number;
  readonly yPaddingRatio?: number;
}

const DEFAULT_MAX_TICKS = 5;
const DEFAULT_Y_PADDING_RATIO = 0.12;

/** Every distinct date across all series, ascending. */
export function mergedDomainOf(series: readonly TrendSeries[]): string[] {
  const dates = new Set<string>();
  for (const s of series) for (const point of s.points) dates.add(point.date);
  return [...dates].sort((a, b) => a.localeCompare(b));
}

/** `categorical[index]`, wrapping into `other` once the ramp runs out rather than repeating
 *  a colour two series could be confused by. */
export function colorFor(
  index: number,
  categorical: readonly string[],
  other: string,
): string {
  return index < categorical.length ? categorical[index]! : other;
}

/** Evenly spaced indices across `[0, n - 1]`, deduped, at most `count`. */
export function pickTickIndices(n: number, count: number): readonly number[] {
  if (n <= 0) return [];
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const indices = Array.from({ length: count }, (_, i) =>
    Math.round((i * (n - 1)) / (count - 1)),
  );
  return [...new Set(indices)];
}

/** Splits a series' domain indices into contiguous runs (consecutive domain positions);
 *  a gap -- a day the series has no point for -- starts a new run. */
function segmentIndicesOf(indices: readonly number[]): (readonly number[])[] {
  const segments: number[][] = [];
  let current: number[] = [];
  for (const index of indices) {
    if (current.length > 0 && index !== current[current.length - 1]! + 1) {
      segments.push(current);
      current = [];
    }
    current.push(index);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** The shared x position for a domain index -- centred when the whole domain is one date, so
 *  a one-day period renders a single point rather than dividing by zero. */
function xAt(index: number, domainLength: number, width: number): number {
  if (domainLength <= 1) return width / 2;
  return (index / (domainLength - 1)) * width;
}

/**
 * The full chart layout: every series positioned onto a shared date domain and value range,
 * ticks and legend entries. `series` with zero points across all of them yields `isEmpty:
 * true` and an otherwise-empty layout.
 */
export function layoutOf(
  series: readonly TrendSeries[],
  categorical: readonly string[],
  other: string,
  options: LayoutOptions,
): TrendLayout {
  const { width, height } = options;
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS;
  const yPaddingRatio = options.yPaddingRatio ?? DEFAULT_Y_PADDING_RATIO;

  const domain = mergedDomainOf(series);
  const totalPoints = series.reduce((sum, s) => sum + s.points.length, 0);
  if (domain.length === 0 || totalPoints === 0) {
    return { domain, series: [], ticks: [], legend: [], isEmpty: true };
  }

  const domainIndex = new Map(domain.map((date, index) => [date, index] as const));
  const values = series.flatMap((s) => s.points.map((point) => point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueRange = max - min;
  const padding = (valueRange || 1) * yPaddingRatio;
  const top = max + padding;
  const bottom = min - padding;
  const span = top - bottom || 1;
  const yAt = (value: number): number => height - ((value - bottom) / span) * height;

  const positionedSeries: PositionedSeries[] = series.map((s, seriesIndex) => {
    const sorted = [...s.points].sort(
      (a, b) => domainIndex.get(a.date)! - domainIndex.get(b.date)!,
    );
    const points: PositionedPoint[] = sorted.map((point) => ({
      ...point,
      x: xAt(domainIndex.get(point.date)!, domain.length, width),
      y: yAt(point.value),
    }));
    const indices = sorted.map((point) => domainIndex.get(point.date)!);
    const segments = segmentIndicesOf(indices)
      .filter((segment) => segment.length >= 2)
      .map((segment) => segment.map((index) => points[indices.indexOf(index)]!));
    return {
      key: s.key,
      label: s.label,
      color: colorFor(seriesIndex, categorical, other),
      points,
      segments,
    };
  });

  const tickIndices = pickTickIndices(domain.length, maxTicks);
  const ticks: AxisTick[] = tickIndices.map((index) => ({
    date: domain[index]!,
    x: xAt(index, domain.length, width),
    anchor: index === 0 ? "start" : index === domain.length - 1 ? "end" : "middle",
  }));

  const legend: LegendEntry[] = positionedSeries
    .filter((s) => s.points.length > 0)
    .map((s) => ({ key: s.key, label: s.label, color: s.color }));

  return { domain, series: positionedSeries, ticks, legend, isEmpty: false };
}
