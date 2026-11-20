# Tasks: Lead time — implement-to-merged-main as a tile and trend chart

Refs #144. Pre-refined issue — acceptance criteria below are the source of truth.

Blocked-by #142 and #143 (the dashboard shell and the chart components the
deployment-frequency story was meant to introduce) have **not** landed: there is no
`Sparkline` or `TrendChart` component yet, only `StatTile` (primitives) and `DataTable`
(data-display). Following the precedent set by archived change
`2026-11-20-time-in-stage-breakdown` (built ahead of #162 for the same reason), this change
adds the minimal `Sparkline`/`TrendChart` it needs now rather than waiting — #142/#143 can
consolidate or supersede them later.

Scope decisions, made so implementation does not re-litigate them:

- The timeline-fetching module already exists: `src/server/metrics.ts` fetches and caches
  every issue's full `TimelineEvent[]` (`labeled`/`unlabeled` among them) as
  `RepoSnapshot.issueTimelines`. Reuse it as-is — do not add a second fetch path.
- `computeLeadTime` is a pure function over already-fetched data (issues + their
  timelines), never a network call, so it is trivially unit-testable per the acceptance
  criteria.
- Algorithm: for each issue, scan its timeline's `labeled` events in order. Track the most
  recent `created_at` at which `implement` was labelled (overwritten on every re-add, so a
  removed-then-re-added `implement` always uses the latest occurrence per the edge case).
  The first `labeled` event for `merged-main` is the issue's arrival at `main`
  (`mergedAt`). If, at that point, no `implement` labelling has yet been seen, the issue is
  excluded (not yet merged relative to an `implement` label, or `merged-main` happened
  with no preceding `implement` event in the timeline at all — both are "no lead time yet").
  Otherwise the entry's `days` is `(mergedAt - implementAt) / 86_400_000`, fractional, never
  rounded in the computation itself (only at render time).
- A day's figure is attributed to `mergedAt`'s UTC calendar date (`YYYY-MM-DD`, the same
  `dayOf`-style slice `src/shared/trends.ts` already uses — do not import that module, it is
  keyed on `LoopRun`, not issues; just inline the same one-line slice).
- "Median lead time for the period" filters entries by `mergedAt` falling in `[from, to]`
  (the same half-open-by-string-compare convention `shippedInPeriod` in
  `src/web/timeInStageBar.ts` already uses), then takes the median of their `days` — a
  plain local median helper in `leadTime.ts` (do not import `src/shared/trends.ts`'s
  private `median`, it is not exported and that module is runs-shaped, not issues-shaped).
  Per-day medians use the same grouping, one bucket per UTC day with at least one entry
  (a day with none is simply absent, never a zero point).
- No new chart dependency: `Sparkline` and `TrendChart` are plain inline SVG (`<svg>`,
  `<polyline>`/`<path>`), styled only through theme tokens (Rule 2/3 — stroke colour via
  `useStatusTone`/the existing `brand.main` token, never a literal). This repository has no
  `recharts`/`d3`/`visx` dependency and adding one for two small line renderers is out of
  scope.
- API surface: add `/api/lead-time` to `src/server/main.ts`, mirroring `/api/flow`'s
  shape exactly (`?repo=&period=`, reads the same `metricsCache`, 404
  `{ error: "not configured or not yet refreshed" }` when the cache has nothing yet),
  calling `computeLeadTime(snapshot.issues, snapshot.issueTimelines, from, to)` where
  `from`/`to` come from `parsePeriod` the same way `/api/flow` already resolves them
  (reuse `src/server/flow.ts`'s `parsePeriod`/period-to-dates math — do not write a third
  period parser; if the date math is not already a standalone exported step, add the two
  or three lines needed to expose `{from, to}: Date` from a `Period` without duplicating
  `buildFlow`'s internals).

## 1. `computeLeadTime` and its types

- [x] 1.1 Add `src/server/metrics/leadTime.ts` (new directory, alongside the existing
      `src/server/metrics.ts` file — both resolve fine since every import in this
      repository already uses explicit `.js` extensions). Export:
      - `LeadTimeEntry { issue: number; title: string; url: string; days: number; mergedAt: string }`
      - `LeadTimeDailyMedian { date: string; medianDays: number }`
      - `LeadTimeResult { entries: readonly LeadTimeEntry[]; dailyMedians: readonly LeadTimeDailyMedian[]; medianDays: number | undefined }`
        (`medianDays` is `undefined` when `entries` is empty for the period — never `0`,
        matching this codebase's "absent beats false zero" convention, e.g.
        `successRateOf`).
      - `computeLeadTime(issues: readonly { number: number; title: string; html_url: string; }[], timelines: Record<number, readonly TimelineEvent[]>, from: Date, to: Date): LeadTimeResult`
        implementing the algorithm above. Only type-import `TimelineEvent` from
        `../metrics.js`.
- [x] 1.2 Add `src/server/metrics/leadTime.test.ts`: hand-built `TimelineEvent[]` fixtures
      (mirroring the forge's real `labeled`/`unlabeled` shape, the same style
      `flow.test.ts` already uses) covering, each asserted against an exact expected
      value:
      - a straightforward issue: `implement` at T0, `merged-main` at T1, lead time exactly
        `(T1-T0)/86_400_000` days.
      - the reopen edge case: `implement` labelled, unlabelled, re-labelled at a later T0',
        then `merged-main` — the result must use T0', not the first `implement` event.
      - an issue carrying `implement` with no `merged-main` event at all — excluded from
        `entries`, confirmed by its absence (not a zero-valued entry).
      - two issues reaching `main` on the same UTC day with different lead times — the
        day's `dailyMedians` entry is their median, not their sum or mean (pick values
        where median ≠ mean, e.g. 1 and 9 days, to actually distinguish the two).
      - `medianDays` is `undefined` when no issue in `[from, to]` has a computable lead
        time.
      - a `from`/`to` period filter that excludes an otherwise-valid entry whose
        `mergedAt` falls outside the window.

## 2. API endpoint

- [x] 2.1 In `src/server/flow.ts`, export a small `periodWindow(period: Period, now: Date): { from: Date; to: Date }`
      factored out of `buildFlow`'s existing inline `from`/`to` computation (so `buildFlow`
      calls it too — one computation, not two) rather than duplicating the "all" vs.
      "days" branch a second time in `main.ts`.
- [x] 2.2 In `src/server/main.ts`, add a `/api/lead-time` route following the exact
      `/api/flow` pattern: parse `repo`/`period` query params, 404 with the same error
      body when `metricsCache.get(repo)?.snapshot` is undefined, else resolve
      `{ from, to }` via `periodWindow(parsePeriod(...), new Date())` and respond with
      `computeLeadTime(cached.snapshot.issues, cached.snapshot.issueTimelines, from, to)`
      as JSON.

## 3. `Sparkline` and `TrendChart` (minimal, new — see scope decision above)

- [x] 3.1 Add `src/components/data-display/Sparkline.tsx`: a small inline-SVG line
      (props: `points: readonly number[]`, optional `width`/`height` with sensible
      defaults e.g. 80×24), stroke colour from a theme token (`theme.palette.brand.main`
      via `useTheme()`, not a literal — Rule 2), no axes/labels/legend (it is a sparkline).
      Render nothing (or a muted empty state, `HelperText`) for fewer than two points —
      never throw on an empty series.
- [x] 3.2 Add `src/components/data-display/TrendChart.tsx`: a larger inline-SVG line
      chart (props: `points: readonly { date: string; value: number }[]`, `height`
      e.g. 160, optional `valueLabel` formatter for the Y hover/axis text), still theme
      tokens only, with a simple date axis (a handful of tick labels, not every point) and
      a hover/focus state showing the exact value per the accessibility rule (text, not
      colour alone — a `<title>` element per point or a simple tooltip is sufficient; do
      not pull in a charting library for this).
      Export both from `src/components/data-display/index.ts` (already exists —
      add the two exports alongside `DataTable`/`KeyValueGrid`).
- [x] 3.3 These are presentational only — no tests required beyond the typecheck/build
      gate (this repository's test convention is for computation modules, e.g.
      `timeInStageBar.ts`/`waitingOnPerson.ts`, not for `.tsx` renderers, which have no
      existing test precedent in `src/components/`).

## 4. Wiring: Overview (stat tile + sparkline) and Delivery (trend chart + table)

- [ ] 4.1 Add `src/web/leadTime.ts` (pure, browser-safe, type-only import from
      `../server/metrics/leadTime.js`): a thin `formatLeadTimeDays(days: number): string`
      (one decimal place, e.g. `"2.3d"`) helper only — the fetched `LeadTimeResult` JSON
      already has everything else a page needs; do not duplicate `computeLeadTime` here.
- [ ] 4.2 Wire `src/web/pages/Overview.tsx` (currently just `<PageHeader title="Overview" />`,
      per its own comment, waiting for a sibling story to build something): fetch
      `/api/repo` then `/api/lead-time?repo=&period=` (same two-effect pattern
      `Delivery.tsx` already uses for `/api/flow`), and render a `Section` containing a
      `StatTile` (`label="Lead time"`, `value={formatLeadTimeDays(result.medianDays)}` or
      an em dash when `medianDays` is `undefined`, `sub={<Sparkline points={result.dailyMedians.map(d => d.medianDays)} />}`).
- [ ] 4.3 Wire `src/web/pages/Delivery.tsx`: alongside the existing "Where time goes" and
      "Waiting on a person" sections, fetch `/api/lead-time` the same way (reuse the
      `repo`/`period` state already in this component) and add a "Lead time" `Section`
      containing a `TrendChart` of `dailyMedians` plus a `DataTable` of `entries`
      (columns: issue link via `<a href={entry.url}>` — the same plain-anchor convention
      `loopTable.ts`/`WaitingOnPersonList` use for external GitHub links, title, merged
      date, lead time days formatted via `formatLeadTimeDays`).
- [ ] 4.4 Add `src/web/leadTime.test.ts` for `formatLeadTimeDays` (a couple of fixed
      values, including the one-decimal rounding boundary).

## 5. Verification

- [ ] 5.1 `pnpm run typecheck && pnpm run test && pnpm run build` passes with no new
      lint/type errors, and no new colour literal or direct `palette.status` access was
      introduced (Rule 2/3).
