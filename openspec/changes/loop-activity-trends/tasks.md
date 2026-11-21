## 1. Period-scoped trends source

- [ ] 1.1 Add `src/server/metrics/loopTrends.ts`: `computeLoopTrends(runs, from, to)` filters `LoopRun[]` to `startedAt` within `[from, to)` and reuses `aggregateDailyTrends` from `src/shared/trends.ts` (no second counting path), returning `{ points: readonly DailyTrendPoint[] }`.
- [ ] 1.2 Add `/api/loop-trends?repo=&period=` to `src/server/main.ts`, mirroring the `/api/flow` / `/api/lead-time` branches: read the cached snapshot, compute `periodWindow`, call `computeLoopTrends`, return JSON.
- [ ] 1.3 Tests in `src/server/metrics/loopTrends.test.ts`: runs outside the window are excluded; a day's aggregated figures equal a brute-force recount of that day's runs within the fixture (property check, following `src/shared/trends.test.ts`'s own style).

## 2. Categorical chart colour token

- [ ] 2.1 Add a `chart` semantic slot (`categorical: readonly string[]`, `other: string`) to `src/theme/palette.ts` (both `palette` and `darkPalette`) and its type in `src/theme/module-augmentation.ts`, using a CVD-safe (Okabe-Ito) ramp — a new design decision, so a token, never a literal at the call site.
- [ ] 2.2 Test in `src/theme/contrast.test.ts` (or a new `chart` describe block): every categorical colour clears the non-text (3:1) contrast threshold against the dark page background.

## 3. Multi-series trend chart primitive

- [ ] 3.1 Extend `src/components/data-display/TrendChart.tsx` to accept either a single `points` series (existing lead-time call site, unchanged behaviour) or multiple named `series`, rendering a legend entry per series when more than one is given, reading colours from `theme.palette.chart.categorical` (never a literal).
- [ ] 3.2 Move the pure (non-React) layout logic — x-domain, tick selection, per-series colour assignment, legend entries, contiguous line segments so a series' gap day is never bridged by an interpolated line — into `src/components/data-display/trendChart.ts`, unit-testable without a DOM.
- [ ] 3.3 True empty state (zero points across every series) renders distinctly from the existing "not enough data yet" single-point case; a single point across the whole chart renders as one marker, not an error, per the one-day-period edge case.
- [ ] 3.4 Tests in `src/components/data-display/trendChart.test.ts`: empty-state selection for no data, a route absent from every day is never given a legend entry, a route present on only some days keeps one legend entry, single-point domain handling.

## 4. Loop page client-side aggregation helpers

- [ ] 4.1 Add `src/web/loopTrends.ts`: pure functions turning `readonly DailyTrendPoint[]` into each panel's `TrendSeries[]` — runs-per-route, outcome-mix (fixed order: acted, no-action, handed-to-human, failed, unknown), success-rate (single series, values already `[0,1]`), median-duration-per-route, share-needing-a-person (single series) — plus `formatPercent` and `formatDurationMs` (e.g. `"4m"`) formatters.
- [ ] 4.2 Tests in `src/web/loopTrends.test.ts` against hand-built `DailyTrendPoint[]` fixtures, covering the issue's Gherkin scenarios directly (route series/legend, outcome mix categories with no separate "declined", 80% success rate, 4m median duration with an absent-route day, 25% share needing a person).

## 5. `/loop` page and navigation

- [ ] 5.1 Add `src/web/pages/Loop.tsx`: fetches `/api/repo` and `/api/loop-trends?repo=&period=` (the existing `?period=` search param), and renders five `Section`-wrapped `TrendChart` panels (runs per route, outcome mix, success rate, median duration per route, share needing a person) using the task 4 helpers; an empty period renders each panel's empty state rather than a blank area.
- [ ] 5.2 Register the `/loop` route in `src/web/main.tsx` and add a "Loop" entry to `NAV_ENTRIES` in `src/web/Shell.tsx`; correct that file's stale comment, which already names `/loop` for a route that did not exist yet.
