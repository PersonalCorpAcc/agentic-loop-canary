## 1. Pure stats and windowing

- [ ] 1.1 Add `src/shared/stats.ts` with `median(values)` and `percentile(values, p)` (linear-interpolation, so `percentile(values, 85)` is the 85th percentile), computed with no special-cased minimum sample size.
- [ ] 1.2 Add `src/shared/stats.test.ts`: odd- and even-length `median`, and `percentile` on a set smaller than 5 values.
- [ ] 1.3 Add `PERIOD_DAYS` and `previousPeriodWindow(period, to)` to `src/shared/period.ts`, returning the immediately preceding window of equal length ending exactly at the current window's start (no overlap).
- [ ] 1.4 Add tests in `src/shared/period.test.ts`: given `period="30d"` and a fixed `to`, the previous window is exactly the preceding 30 days and does not overlap `[to - 30d, to]`.

## 2. Server: carry `createdAt` on `FlowItem`

- [ ] 2.1 In `src/server/flow.ts`, add `createdAt: string` to `FlowItem` (the issue's own `created_at`, already read in `buildFlowItem`) so a client can compute lead time without a second API shape.
- [ ] 2.2 Update `flow.test.ts` fixtures/assertions only if the new field breaks an existing equality check (additive field, so none should).

## 3. Throughput (pure + chart)

- [ ] 3.1 Add `src/web/throughput.ts`: `throughputByDay(items, from, to)` — one `{ date, count }` per UTC day in `[from, to]`, count of items whose `shipped` entry falls that day (reuse `shippedInPeriod`'s idiom from `timeInStageBar.ts`).
- [ ] 3.2 Add `src/web/throughput.test.ts`: zero-item days are explicit `0`s, a day with multiple ships counts correctly.
- [ ] 3.3 Add `@mui/x-charts` as a dependency (`pnpm add @mui/x-charts`).
- [ ] 3.4 Add `src/components/domain/ThroughputChart.tsx`: a `BarChart` (`@mui/x-charts`), one bar per relative day offset, "this period" solid + "previous period" muted tone, with a legend.
- [ ] 3.5 Add `src/components/primitives/ChartSkeleton.tsx`: a `Skeleton variant="rectangular"` sized to the chart's final height, used when a period has zero shipped items (per #159's rule — never a flat zero-line chart).

## 4. Lead time (pure + chart)

- [ ] 4.1 Add `src/web/leadTime.ts`: `leadTimeStats(items, from, to)` returning `{ median, p85, sampleCount, excludedCount }` in hours, over items shipped in `[from, to]`, excluding any item whose computed duration (shipped-entry timestamp minus `createdAt`) is not a finite positive number (no reliable creation lineage).
- [ ] 4.2 Add `src/web/leadTime.test.ts`: the exclusion rule, an even-length and a smaller-than-5 sample set (via `median`/`percentile` from `stats.ts`).
- [ ] 4.3 Add `src/components/domain/LeadTimeChart.tsx`: a `LineChart` (`@mui/x-charts`) plotting `[median, p85]` for "this period" (solid) and "previous period" (dashed, muted tone), with a legend, and the excluded-count note (`HelperText`) below the chart.

## 5. Wire into the Delivery page

- [ ] 5.1 In `src/web/pages/Delivery.tsx`, add a "Throughput" section (`ThroughputChart`) and a "Lead time" section (`LeadTimeChart`), each computing its own previous-period window from `flow.to` and the `period` search param, each rendering `ChartSkeleton` instead of the chart when the current period has zero shipped items.
