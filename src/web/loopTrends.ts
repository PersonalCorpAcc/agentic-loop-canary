/**
 * Turns the server's `DailyTrendPoint[]` (`src/shared/trends.ts`) into the `TrendSeries[]`
 * each `/loop` panel hands `TrendChart` (#149), plus the two value formatters the panels'
 * tooltips use. No counting happens here -- every number is read straight off the point the
 * server already computed from that day's raw runs.
 *
 * `runsByRoute` and `medianDurationByRoute` carry a route only on a day it has data for (the
 * "absent, not zero" convention `trends.ts` documents), so the per-route series below omit a
 * gap day entirely rather than inserting a `0` -- `TrendChart` then draws it as a break in the
 * line rather than a dip to zero.
 */
import type { TrendSeries } from "@/components/data-display";

import type { DailyTrendPoint } from "../shared/trends.js";
import { outcomeMixKeys } from "../shared/trends.js";

/** Every route named by any day's `runsByRoute`/`medianDurationByRoute`, alphabetical so the
 *  two per-route panels (and their legends/colours) order routes the same way. */
function routesOf(points: readonly DailyTrendPoint[], pick: (point: DailyTrendPoint) => Readonly<Record<string, number>>): string[] {
  const routes = new Set<string>();
  for (const point of points) for (const route of Object.keys(pick(point))) routes.add(route);
  return [...routes].sort();
}

/** One series per route, a point only on a day that route actually ran. */
export function runsByRouteSeriesOf(points: readonly DailyTrendPoint[]): TrendSeries[] {
  const routes = routesOf(points, (point) => point.runsByRoute);
  return routes.map((route) => ({
    key: route,
    label: route,
    points: points
      .filter((point) => route in point.runsByRoute)
      .map((point) => ({ date: point.day, value: point.runsByRoute[route]! })),
  }));
}

/** One series per known outcome plus "unknown" (never a separate "declined"), in that fixed
 *  order -- every day gets a point for every key, since a day with zero of an outcome is a
 *  real, known count rather than missing data. */
export function outcomeMixSeriesOf(points: readonly DailyTrendPoint[]): TrendSeries[] {
  return outcomeMixKeys.map((key) => ({
    key,
    label: key,
    points: points.map((point) => ({ date: point.day, value: point.outcomeMix[key] })),
  }));
}

/** A single unnamed series: the non-failed share of known-outcome runs, in [0, 1]. A day with
 *  no known-outcome run (`successRate` undefined) is omitted rather than shown as 0. */
export function successRateSeriesOf(points: readonly DailyTrendPoint[]): readonly { date: string; value: number }[] {
  return points
    .filter((point) => point.successRate !== undefined)
    .map((point) => ({ date: point.day, value: point.successRate! }));
}

/** One series per route, a point only on a day that route had at least one finished run. */
export function medianDurationByRouteSeriesOf(points: readonly DailyTrendPoint[]): TrendSeries[] {
  const routes = routesOf(points, (point) => point.medianDurationByRoute);
  return routes.map((route) => ({
    key: route,
    label: route,
    points: points
      .filter((point) => route in point.medianDurationByRoute)
      .map((point) => ({ date: point.day, value: point.medianDurationByRoute[route]! })),
  }));
}

/** A single unnamed series: the share of that day's runs for which `needsAttention` is true,
 *  in [0, 1]. Always defined for a day with any runs (`trends.ts` gives it 0 otherwise, and a
 *  day with zero runs never appears in the aggregated points at all). */
export function shareNeedingAttentionSeriesOf(
  points: readonly DailyTrendPoint[],
): readonly { date: string; value: number }[] {
  return points.map((point) => ({ date: point.day, value: point.shareNeedingAttention }));
}

/** `0.8` -> `"80%"`. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Milliseconds as the coarsest unit that keeps one decimal of precision: `"45s"`, `"4m"`,
 *  `"2.5h"`. */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  return `${(totalMinutes / 60).toFixed(1)}h`;
}
