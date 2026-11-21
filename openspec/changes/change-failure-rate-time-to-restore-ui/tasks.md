# Tasks: Change failure rate and time to restore — Overview tiles and Delivery trend charts

Refs #219. See `proposal.md` for the scope decisions this checklist implements.

## 1. Computation layer additions

- [ ] 1.1 In `src/server/metrics/changeFailureRate.ts`, add `ChangeFailureRateBucket
      {date, shipped, failed, rate}` and `changeFailureRateBuckets(timelines, mergedLabel,
      from, to): {buckets, granularity}` — daily buckets when the resolved span is `<= 30`
      days, weekly otherwise (same rule `deploymentFrequency.ts`'s `granularityOf` uses).
      Do not change `computeChangeFailureRate`'s existing signature or result shape.
- [ ] 1.2 In the same file, add `ChangeFailureEntry {issue, title, url, pullRequest?:
      {number, url}, label, openedAt, closedAt?, days?}` and `changeFailureEntries(
      failedIssueNumbers, issues, timelines, pullRequests): ChangeFailureEntry[]` — for each
      failed issue number, find its issue metadata, its earliest hold/rollback span
      (opened/closed/days, `closedAt`/`days` undefined if still open), and its implementing
      pull request via `carriedIssuesOf` (imported from `../runs.js`).
- [ ] 1.3 In `src/server/metrics/timeToRestore.ts`, add `TimeToRestoreBucket {date,
      averageDays, count}` and `timeToRestoreBuckets(timelines, from, to): {buckets,
      granularity}`, same granularity rule, bucketed by each sample's `closedAt`.
      Do not change `computeTimeToRestore`'s existing signature or result shape.
- [ ] 1.4 Add tests for all three new functions in their respective `.test.ts` files:
      bucket boundaries/granularity switch, an issue with an open (unclosed) incident
      showing up in `changeFailureEntries` with `closedAt`/`days` undefined, an issue with
      no discoverable pull request, and the zero-shipped/zero-sample empty cases.

## 2. API endpoints

- [ ] 2.1 In `src/server/main.ts`, add `/api/change-failure-rate`: parse `repo`/`period`,
      404 with the existing error body when the cache has no snapshot yet, else resolve
      `{from, to}` via `periodWindow`, build `IssueTimeline[]` from
      `cached.snapshot.issues`/`issueTimelines` (the same shape `computeChangeFailureRate`
      already expects), call `computeChangeFailureRate` for the current and the
      previous (`[from - (to-from), from)`) window, call `changeFailureRateBuckets` for
      both windows, and `changeFailureEntries` for the current window's `failed`. Respond
      with `{shipped, rate, previousShipped, previousRate, buckets, previousBuckets,
      granularity, entries}`.
- [ ] 2.2 Add `/api/time-to-restore` the same way: `computeTimeToRestore` for current and
      previous windows, `timeToRestoreBuckets` for both. Respond with `{averageDays,
      sampleCount, previousAverageDays, previousSampleCount, buckets, previousBuckets,
      granularity}`.

## 3. TrendChart previous-period overlay

- [ ] 3.1 Add an optional `previousPoints?: readonly {date: string; value: number}[]` prop
      to `src/components/data-display/TrendChart.tsx`. When present and the same length as
      `points`, draw a second polyline at the same x positions (index-aligned) using
      `strokeDasharray`, scaled against the *same* y-domain as the current series (compute
      `min`/`max` across both series so one series never clips against the other's scale).
      No `<circle>`/tooltip markers on the dashed line — it is context, not an interactive
      series. Existing callers (lead time, deployment frequency) are unaffected since the
      prop is optional.

## 4. Web format helpers

- [ ] 4.1 Add `src/web/changeFailureRate.ts`: `formatChangeFailureRatePercent(rate):
      string` (whole-percent, e.g. `"25%"`) and `formatChangeFailureRateDelta(shipped,
      previousShipped, rate, previousRate): string` — `"no changes shipped in this
      period"` when `shipped === 0`, `"no prior data"` when `previousShipped === 0`,
      otherwise a signed percentage-point delta (e.g. `"+5pp vs previous period"`,
      `"no change vs previous period"` at zero delta).
- [ ] 4.2 Add `src/web/timeToRestore.ts`: `formatTimeToRestoreDays(days): string` (one
      decimal, e.g. `"2.3d"`, matching `formatLeadTimeDays`) and
      `formatTimeToRestoreDelta(sampleCount, previousSampleCount, averageDays,
      previousAverageDays): string` — same no-data/no-change/signed-delta shape as 4.1,
      in days rather than points.
- [ ] 4.3 Add `src/web/changeFailureRate.test.ts` and `src/web/timeToRestore.test.ts`
      covering both helpers' zero/positive/negative cases, mirroring
      `deploymentFrequency.test.ts`.

## 5. Overview and Delivery wiring

- [ ] 5.1 `src/web/pages/Overview.tsx`: fetch `/api/change-failure-rate` and
      `/api/time-to-restore` (same two-effect-per-metric pattern already used), add a
      "Change failure rate" `Section` with a `StatTile` (`value=
      formatChangeFailureRatePercent(result.rate)`, `sub` = `Sparkline` over
      `result.buckets.map(b => b.rate)` plus the delta line) and a "Time to restore"
      `Section` the same way (`value = formatTimeToRestoreDays(result.averageDays)`).
      Each renders nothing until its fetch resolves, matching the existing tiles'
      `undefined`-while-loading convention.
- [ ] 5.2 `src/web/pages/Delivery.tsx`: fetch both endpoints (reusing the existing
      `repo`/`searchParams` effect pattern), add a "Change failure rate" `Section`
      containing a `TrendChart` (`points` = current buckets' `rate`, `previousPoints` =
      previous buckets' `rate`, both index-aligned) and, when `entries.length > 0`, a
      `DataTable<ChangeFailureEntry>` of the failed changes (columns: issue — plain
      anchor to `entry.url`; pull request — plain anchor to `entry.pullRequest.url` or an
      em-dash when undiscoverable; hold/rollback time — `formatTimeToRestoreDays(days)`
      or `"ongoing"` when `closedAt` is undefined). Add a "Time to restore" `Section`
      with its own dashed `TrendChart` (`averageDays` per bucket). Both sections show an
      explicit `HelperText` empty state when nothing shipped/failed in the period, the
      same convention the deployment-frequency section already uses.

## 6. Verification

- [ ] 6.1 `pnpm run typecheck && pnpm run test && pnpm run build` passes with no new
      lint/type errors.
