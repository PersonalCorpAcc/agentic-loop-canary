# Tasks: Throughput and lead-time trend charts

Refs #164. Pre-refined issue — acceptance criteria in the issue body are the source of
truth. Second attempt: the first (opened as #214, branch `agent/164-44805610342/trend-charts`)
was built against an older point in `dev` and, if merged as-is, would delete sibling metrics
work that has since landed (`leadTime.ts`'s `/api/lead-time`, `deploymentFrequency.ts`'s
`/api/deployment-frequency`, `changeFailureRate.ts`, `timeToRestore.ts`, soak timers). Its
closing was also not a real merge — the issue was reopened because a promotion counted it as
shipped without the PR ever landing. This attempt salvages that branch's design (it already
covers every acceptance criterion cleanly) but re-cuts it additively against current `dev`,
the same way `2026-11-21-deployment-frequency-metric`'s tasks.md re-cut its own first attempt.

Scope decisions, made so implementation does not re-litigate them:

- **This is a client-side-only computation, no new API endpoint.** `/api/flow` already
  returns every `FlowItem` (with `history` and, after task 1 below, `createdAt`) for the
  resolved period window. Throughput and lead-time stats are pure functions over that
  already-fetched `FlowResult`, mirroring the stale branch's approach — avoids a third copy
  of the `metricsCache`/`periodWindow` endpoint boilerplate `leadTime.ts`/
  `deploymentFrequency.ts` already duplicate once each.
- **`FlowItem` gains a `createdAt: string` field** (the issue's own `created_at`, already
  read by `buildFlowItem` but not currently carried on the type), so the lead-time
  computation can pair it with the item's `shipped` history entry without a second fetch
  shape. Purely additive to the interface and its one construction site in
  `src/server/flow.ts`.
- **`src/server/flow.ts` already has its own `periodWindow`/`Period`/`parsePeriod`**
  (`{days}|{all}`, added since the stale branch was cut) — do not touch, duplicate, or
  reconcile that with `src/shared/period.ts` as part of this change; it is out of scope.
  The *previous-period* comparison this issue needs is new and separate: add
  `previousPeriodWindow` to `src/shared/period.ts` (the client-facing `"7d"|"30d"|"90d"`
  `Period`, the one the page's own `?period=` already parses), returning the equal-length,
  non-overlapping window immediately preceding `[to - days, to]` — same convention
  `deploymentFrequency.ts`'s inline `previousFrom` math already uses, just factored out
  since this is its second call site.
- **No special-cased minimum sample size anywhere** (median/percentile, throughput
  bucketing): a period with 0, 1, or 4 shipped items still computes and renders a real
  value; only a *zero-shipped* period swaps the chart for the empty-state skeleton.
- **New generic order-statistics module**: `src/shared/stats.ts` (`median`, `percentile`,
  linear interpolation, no minimum-sample special case) — this finally gives the codebase
  one shared implementation instead of a third private per-file `median()` copy (`flow.ts`
  and `src/shared/trends.ts` each already have their own). Existing private copies are left
  alone; only new code here uses the shared one.
- **Naming collision with the existing "Lead time" section/metric, resolved explicitly**:
  `src/web/leadTime.ts` already exports `formatLeadTimeDays` (days, `implement`→
  `merged-main` label events, powering the existing `/api/lead-time`-backed "Lead time"
  `Section` on `Delivery.tsx`). This issue's lead time is a *different* metric — hours,
  issue `created_at`→`shipped`-stage-entry, median+p85 — computed client-side from
  `FlowItem[]`. Add the new `leadTimeStats`/`leadTimeHours`/`LeadTimeStats` exports
  **alongside** `formatLeadTimeDays` in the same file (additive, never remove or rename the
  existing export or its callers), and title the new `Delivery.tsx` section **"Lead time
  trend (created → shipped)"** so the two "lead time" concepts are never ambiguous on the
  same page.
- **`@mui/x-charts` is a new dependency** (not currently in `package.json`), pinned to
  `8.29.3` (the version the stale branch already validated against this repo's
  `@mui/material@6.5.0`). Adding it touches `package.json` and `pnpm-lock.yaml` — expect the
  merge gate to flag these as protected files requiring human review, same as the first
  attempt; that is expected and not a defect to work around.
- **Empty-state**: a new `ChartSkeleton` primitive (`src/components/primitives/`) — a
  `Skeleton variant="rectangular"` sized to the chart's height plus a `HelperText` message
  below — renders instead of either chart when zero items shipped in the period, per #159's
  "skeleton-shaped, not a flat zero-line" rule. Both charts share one component since the
  rule is identical for both.
- **Previous-period dashing**: `@mui/x-charts`' series types have no native dash prop, so
  the previous-period series is dashed via an `sx` override on the library's generated
  `.MuiLineElement-series-{id}`/bar-equivalent class for that series id, with
  `theme.palette.text.disabled` for its muted color. Current-period color routes through
  `useStatusTone` (the sanctioned `palette.status` accessor, ESLint rule 018 R-07) — never a
  raw palette literal.
- **Excluded-lineage items**: a shipped item whose computed `createdAt`→`shipped` duration is
  not a finite positive number (shipped-before-created, or an unparsable timestamp) is
  dropped from the sample and counted in a separate `excludedCount`, rendered as a
  `HelperText` note below the lead-time chart when nonzero — never folded into the
  median/p85 as a zero or negative value.

## 1. `FlowItem.createdAt` and the previous-period window helper

- [ ] 1.1 In `src/server/flow.ts`, add `readonly createdAt: string` to the `FlowItem`
      interface and populate it from `issue.created_at` at `buildFlowItem`'s one return
      site (the value is already read into `history` via `replayFlowStageHistory`'s
      `createdAt` param — just also carry it onto the returned object). No other field,
      export, or the existing `Period`/`parsePeriod`/`periodWindow` trio changes.
- [ ] 1.2 In `src/shared/period.ts`, add `PERIOD_DAYS: Record<Period, number>` (`7d`→7,
      `30d`→30, `90d`→90) and
      `previousPeriodWindow(period: Period, to: Date): { readonly from: string; readonly to: string }`
      returning the non-overlapping equal-length window ending exactly where
      `[to - days, to]` begins.
- [ ] 1.3 Extend `src/shared/period.test.ts` with cases for `previousPeriodWindow`: given
      `period="30d"` and a fixed `to`, the previous window is exactly the preceding 30
      days and does not overlap `[to - 30d, to]`; same check for `"7d"` and `"90d"`.

## 2. `src/shared/stats.ts` — median and percentile

- [ ] 2.1 Add `src/shared/stats.ts`: `percentile(values: readonly number[], p: number): number`
      (sorted copy, linear interpolation between the two nearest ranks, `NaN` for an empty
      input, the single value for a one-item input) and `median(values) => percentile(values, 50)`.
      No minimum-sample special case.
- [ ] 2.2 Add `src/shared/stats.test.ts`: median over an odd-length set, median over an
      even-length set (average of the two middle values), median/percentile over a set
      smaller than 5 values, the 85th percentile over a fixed ten-value set, and a
      one-item set.

## 3. Pure throughput and lead-time functions (client-side, over `FlowItem[]`)

- [ ] 3.1 Add `src/web/throughput.ts`: `ThroughputDay { date: string; count: number }` and
      `throughputByDay(items: readonly FlowItem[], from: Date, to: Date): ThroughputDay[]`
      — reuses `shippedInPeriod` from `./timeInStageBar.js`, one entry per UTC calendar day
      in `[from, to]` inclusive, every day present with an explicit count (`0` where
      nothing shipped), summing to the shipped count in the window.
- [ ] 3.2 Add `src/web/throughput.test.ts`: a zero-ships window (every day `0`), multiple
      ships landing on the same UTC day, and an unshipped item excluded entirely.
- [ ] 3.3 In `src/web/leadTime.ts`, **add** (do not replace) `LeadTimeStats { median: number;
      p85: number; sampleCount: number; excludedCount: number }`,
      `leadTimeHours(item: FlowItem): number | undefined` (hours from `item.createdAt` to
      its `shipped` history entry, `undefined` when not finite-positive), and
      `leadTimeStats(items: readonly FlowItem[], from: string, to: string): LeadTimeStats`
      (filters to `shippedInPeriod`, computes `{median, p85}` via `src/shared/stats.js`
      over the non-excluded hours, counts the rest in `excludedCount`). The existing
      `formatLeadTimeDays` export and its callers are untouched.
- [ ] 3.4 Extend `src/web/leadTime.test.ts` with cases for `leadTimeStats`: a fixed set of
      lead times including an even-length set (median across the two middle values) and a
      set smaller than 5 items (still computed), plus an item with an unreliable lineage
      (shipped timestamp before `createdAt`) excluded and counted in `excludedCount` rather
      than producing a negative duration.

## 4. Chart primitives and components

- [ ] 4.1 Add `@mui/x-charts@8.29.3` to `package.json` dependencies; run
      `pnpm install` (not `npx`) so `pnpm-lock.yaml` updates to match, per this repo's
      frozen-lockfile convention.
- [ ] 4.2 Add `src/components/primitives/ChartSkeleton.tsx`
      (`ChartSkeletonProps { height?: number; message?: string }`, default height `240`,
      default message `"No shipped items in this period"`): a `Skeleton
      variant="rectangular"` of that height above a `HelperText` of that message. Export it
      from `src/components/primitives/index.ts`.
- [ ] 4.3 Add `src/components/domain/ThroughputChart.tsx`: a `@mui/x-charts` `BarChart`
      over `{current: readonly ThroughputDay[]; previous: readonly ThroughputDay[]; height?}`,
      one series per period aligned by day-offset (not calendar date, so a 30-day current
      period compares directly against its 30-day predecessor), current period colored via
      `useStatusTone("ok")`, previous period in `theme.palette.text.disabled`, legend
      labelled "This period" / "Previous period".
- [ ] 4.4 Add `src/components/domain/LeadTimeChart.tsx`: a `@mui/x-charts` `LineChart` over
      `{current: LeadTimeStats; previous: LeadTimeStats; height?}`, plotting `median` and
      `p85` (hours) for each of the two periods, current via `useStatusTone("info")`,
      previous dashed (`sx` override on `.MuiLineElement-series-previous`) in
      `theme.palette.text.disabled`, same legend convention as the throughput chart.
- [ ] 4.5 Export both from `src/components/domain/index.ts`.

## 5. Wiring: Delivery page

- [ ] 5.1 In `src/web/pages/Delivery.tsx`, add a `DeliveryTrends` section fed by the
      already-fetched `flow: FlowResult` and the page's parsed `Period`: compute
      `previousPeriodWindow`, `throughputByDay` for both windows, and `leadTimeStats` for
      both windows. Render two new `Section`s — **"Throughput"** (the bar chart) and
      **"Lead time trend (created → shipped)"** (the line chart, distinct from the
      existing "Lead time" section's days/implement-to-merge metric) — each showing
      `ChartSkeleton` instead of its chart when `shippedInPeriod(flow.items, flow.from,
      flow.to)` is empty. Below the lead-time chart, when `excludedCount > 0`, render a
      `HelperText` noting how many shipped items were excluded for lacking a reliable
      creation lineage.
- [ ] 5.2 No change to the existing "Lead time" or "Deployment frequency" sections, their
      fetch effects, or `formatLeadTimeDays` usage.

## 6. Verification

- [ ] 6.1 `pnpm run typecheck && pnpm run test && pnpm run build` passes with no new
      lint/type errors, and no new colour literal or direct `palette.status` access was
      introduced (Rule 018 R-07) outside `useStatusTone`.
