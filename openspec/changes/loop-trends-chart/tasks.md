## 1. Trend-chart data shaping (pure, unit-testable)

- [ ] 1.1 Add `src/components/data-display/trendChart.ts`: pure helpers that turn `DailyTrendPoint[]` (from `src/shared/trends.ts`) into chart-ready series, so the rendering component has no aggregation logic of its own.
  - `seriesByKeyOf(points, pick)`: given an accessor returning a day's `Record<string, number>` (`runsByRoute`, `outcomeMix`, `medianDurationByRoute`), builds one series per key in first-appearance order, each series holding only the days that key is present for -- a key absent on a given day contributes no point for that day, never a zero point (generalising #31's and `trends.ts`'s absent-rather-than-zero rule to the chart layer).
  - `scalarSeriesOf(points, pick, key, color)`: single-series form for `successRate` / `shareNeedingAttention`, skipping days where `pick` returns `undefined`.
  - `isEmptyTrend(points)`: true when there is no point at all, or every point has a totally empty record/undefined scalar.
  - `formatCount`, `formatPercent`, `formatDuration(ms)` value formatters (`"4m"`, `"25%"`, plain counts).
- [ ] 1.2 Add a validated 4-slot categorical color sequence for arbitrary series keys (routes), assigned in fixed first-appearance order with a 5th-and-beyond fold into a shared "Other" slot -- never a generated hue per the dataviz non-negotiable. Document that it is independent of the app's brand/status palette (those failed the categorical CVD checks when tried) and is local to this chart primitive.

## 2. Trend-chart component

- [ ] 2.1 Add `src/components/data-display/TrendChart.tsx`: an SVG line-chart primitive consuming the series shapes from 1.1 -- a day axis, a value axis with the chosen formatter, a legend when there is more than one series (none for exactly one), an empty-state message when `isEmptyTrend`, and a tooltip reachable by both hover and keyboard focus on each point showing every series' value for that day.
- [ ] 2.2 Mirror `trendChart.ts` and `TrendChart.tsx` into `docs/frontend-theme-kit/components/data-display/` (byte-identical, matching how `DataTable.tsx`/`KeyValueGrid.tsx` are already mirrored) and add a `TrendChart` row to the component catalogue table and the file-tree listing in `docs/frontend-theme-kit/README.md`.

## 3. Tests

- [ ] 3.1 `src/components/data-display/trendChart.test.ts`, following the fixture style of `src/shared/trends.test.ts`: `isEmptyTrend` for no points and for all-empty points; `seriesByKeyOf` gives a key points only for the days it actually appears on (not a zero-padded point for an absent day); `scalarSeriesOf` skips `undefined` days; the formatters' output shapes.

## 4. Scope note

- Issue #149's full scope (five panels live on the `/loop` route, scoped by the top bar's repository/period selectors) stays blocked: `/loop` and the dashboard shell (#147) are not on `dev` yet (only an unrelated Delivery-page shell exists, unmerged, on a different branch). This change delivers the reusable chart primitive and its tests only, continuing the incremental slices this issue has already been delivered in (the day-bucketing aggregation itself landed separately). Wiring the five panels is left to land once #147 merges.
