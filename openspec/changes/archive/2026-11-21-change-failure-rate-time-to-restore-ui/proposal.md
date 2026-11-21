# Proposal: Change failure rate and time to restore — Overview tiles and Delivery trend charts

Refs #219. Follow-up to #145/#181, which shipped `computeChangeFailureRate` and
`computeTimeToRestore` in `src/server/metrics/` as pure computation only (no API route, no
UI). The shell (#142) and the sibling metrics (lead time, deployment frequency, #143/#144)
have since landed and establish the pattern this change reuses rather than inventing a new
one.

## Scope decisions

- `computeChangeFailureRate`/`computeTimeToRestore`'s existing exported signatures and
  result shapes stay exactly as shipped in #181 (`{shipped, failed, rate}` /
  `{samples, averageDays}`) — their existing exact-equality tests keep passing unchanged.
  The richer per-bucket and per-entry data the UI needs is added as new, additional exported
  functions in the same two files, not a rewrite of the existing ones.
- New: `changeFailureRateBuckets(timelines, mergedLabel, from, to)` — daily/weekly
  `{date, shipped, failed, rate}` buckets, same day/week granularity rule
  `deploymentFrequency.ts` already uses (`<= 30 days` span → daily, else weekly).
- New: `changeFailureEntries(failedIssueNumbers, issues, timelines, pullRequests)` — joins
  the `failed` issue numbers against `issues` (title/url) and `pullRequests` (via
  `carriedIssuesOf`, already exported from `src/server/runs.ts`) to produce one row per
  failed change: issue, linked implement pull request (if still discoverable), the
  earliest hold/rollback label's `openedAt`/`closedAt`/`days` (`closedAt`/`days` undefined
  when the incident is still open).
- New: `timeToRestoreBuckets(timelines, from, to)` — daily/weekly `{date, averageDays,
  count}` buckets, same granularity rule.
- Previous-period comparison for both metrics: same-length window immediately before
  `from` (`[from - (to - from), from)`, exclusive end — matches `deploymentFrequency.ts`'s
  own boundary handling), computed by calling the *existing* `computeChangeFailureRate` /
  `computeTimeToRestore` again over the shifted window — no new previous-period math
  inside the pure functions themselves.
- API: add `/api/change-failure-rate` and `/api/time-to-restore` to `src/server/main.ts`,
  mirroring `/api/lead-time`'s exact pattern (`?repo=&period=`, same `metricsCache` read,
  same 404 body). Each response carries current + previous buckets, current + previous
  rate/average, and (for change-failure-rate) the joined `entries` — all computed
  server-side, so the browser only renders.
- UI: `TrendChart` gains an optional `previousPoints` prop — a second, dashed polyline
  drawn at the same x positions as `points` (index-aligned, not date-aligned, since the
  two periods cover different calendar dates by definition). No change to existing
  callers (`previousPoints` is optional).
- Overview gets two more `StatTile`s (change failure rate, time to restore), each with a
  `Sparkline` and a delta-vs-previous-period line, following the `deploymentFrequency`
  tile's existing structure.
- Delivery gets two more trend-chart `Section`s (CFR, TTR), each previous-period dashed,
  plus one `DataTable` of failed changes (columns: issue, pull request, hold/rollback
  time), each a plain anchor link — the same convention the lead-time/deployment-frequency
  tables already use.
- Format helpers: `src/web/changeFailureRate.ts` (`formatChangeFailureRatePercent`,
  `formatChangeFailureRateDelta`) and `src/web/timeToRestore.ts` (`formatTimeToRestoreDays`,
  `formatTimeToRestoreDelta`), mirroring `formatLeadTimeDays`/`formatDeploymentFrequencyDelta`.
