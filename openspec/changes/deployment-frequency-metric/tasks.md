# Tasks: Deployment frequency — stage-arrival timeline + first trend chart

Refs #143. Pre-refined issue — acceptance criteria in the issue body are the source of
truth. Second attempt: the first (#172) conflicted with sibling metrics work
(`leadTime.ts`, `changeFailureRate.ts`, `timeToRestore.ts`, `metrics/timeline.ts`) that
landed on `dev` in the meantime and already built the architecture this change reuses.

Scope decisions, made so implementation does not re-litigate them:

- The per-issue label timeline fetch the issue's grounding describes already exists:
  `src/server/metrics.ts`'s `fetchIssueTimelines` populates `RepoSnapshot.issueTimelines`
  as `Record<number, readonly TimelineEvent[]>`. Reuse it as-is, the same way
  `leadTime.ts`/`changeFailureRate.ts`/`timeToRestore.ts` already do — do not add a
  second fetch path or a new classifier module.
- `Sparkline` and `TrendChart` already exist (`src/components/data-display/`), built by
  the archived `2026-11-20-lead-time-metric` change ahead of this one landing. Reuse them
  exactly as they are (`points: readonly number[]` / `points: readonly {date,value}[]`) —
  do not introduce a second, incompatible shape.
- `.agentic/profile.yml`'s `branching.chain: [dev, test, main]` plus `closeIssueOn: main`
  is why the stage-arrival label this change reads is `merged-main` (`work-router.yml`'s
  `MERGED_STAGE_LABEL` template filled in for the final stage) — same literal
  `leadTime.ts` already reads, exposed here as a parameter default rather than a second
  hardcoded copy.
- A batched `env-promotion` merge stamps `merged-main` on every carried issue individually
  (`LoopRun.carriedIssues` is how the promotion pull request records them, but the stamping
  itself is per-issue) — so counting "one issue, one `merged-main` labelled event" already
  gives the batched-promotion scenario the acceptance criteria describe (three issues
  landing the same day each contribute one to that day's count) with no separate carried-
  issues lookup needed.
- Bucketing: daily UTC-calendar-day buckets when the resolved window spans 30 days or
  less, weekly (Monday-anchored UTC) buckets above that — so "Last 7/30 days" is daily and
  "Last 90 days" is weekly, decided off the actual resolved `from`/`to` span (shared with
  `/api/lead-time`'s `periodWindow`) rather than a second period parse.
- Every bucket in the resolved window is present with an explicit count (`0` where
  nothing merged that day/week), the same "never an absent key" convention
  `flow.ts`'s `cfdBuckets` already uses — except when the period's `total` is `0`, in
  which case the caller (the web pages, not this module) renders the explicit empty
  state the acceptance criteria ask for instead of a flat zero-line.
- Previous-period comparison: same-length window immediately before `from`
  (`[from - (to-from), from]`), returned as a plain `previousTotal: number` (never
  `undefined` — a same-length window is always computable once `from`/`to` are
  concrete `Date`s, the same as every other period math in this codebase). A previous
  total of `0` is a valid value, not a sentinel; the "no prior data" wording is a web-layer
  formatting decision (divide-by-zero avoidance), not something the computation needs to
  signal specially.
- API surface: add `/api/deployment-frequency` to `src/server/main.ts`, mirroring
  `/api/lead-time`'s exact pattern (`?repo=&period=`, same `metricsCache` read, same 404
  body when the cache has nothing yet), computing the previous window via
  `periodWindow`'s own math rather than a new period parser.

## 1. `computeDeploymentFrequency` and its types

- [ ] 1.1 Add `src/server/metrics/deploymentFrequency.ts`. Export:
      - `DeploymentFrequencyEntry { issue: number; title: string; url: string; mergedAt: string }`
      - `DeploymentFrequencyBucket { date: string; count: number }` (`date` is the UTC
        calendar day for daily buckets, or the UTC Monday-anchored week-start day for
        weekly buckets — both `YYYY-MM-DD`)
      - `DeploymentFrequencyResult { entries: readonly DeploymentFrequencyEntry[]; buckets: readonly DeploymentFrequencyBucket[]; granularity: "day" | "week"; total: number; previousTotal: number }`
      - `computeDeploymentFrequency(issues: readonly { number: number; title: string; html_url: string }[], timelines: Record<number, readonly TimelineEvent[]>, from: Date, to: Date, mergedLabel?: string): DeploymentFrequencyResult`
        (default `mergedLabel = "merged-main"`), implementing:
        - per issue, the first (earliest) `labeled` event for `mergedLabel` in its
          timeline is its arrival (`mergedAt`); an issue with no such event is excluded
          from `entries` entirely (never a zero/placeholder entry).
        - `entries` filtered to `mergedAt` within `[from, to]` (inclusive, ISO string
          compare — the same convention `leadTime.ts` already uses), sorted by
          `mergedAt` ascending.
        - `granularity`: `"day"` when `(to - from) <= 30 days`, else `"week"`.
        - `buckets`: one entry per calendar day/week in `[from, to]` (inclusive),
          every one present with an explicit `count` (`0` where nothing merged),
          summing to `entries.length`.
        - `total = entries.length`.
        - `previousTotal`: count of issues whose `mergedAt` falls in the same-length
          window immediately before `from` (`[from - (to-from), from)`), computed the
          same way as `total` but never included in `entries`/`buckets` (those are
          current-period only).
      - Only type-import `TimelineEvent` from `../metrics.js`, the same import `leadTime.ts`
        already uses — no new timeline type.
- [ ] 1.2 Add `src/server/metrics/deploymentFrequency.test.ts`: fixtures of real
      `TimelineEvent[]` shapes (the same hand-built style `leadTime.test.ts` and
      `flow.test.ts` already use — no network call), covering, each asserted against an
      exact expected value:
      - three issues whose timelines each carry a `merged-main` labelled event on the
        same UTC day (the batched-promotion scenario) — that day's bucket count is `3`,
        and all three appear, linked, in `entries`.
      - an issue whose `merged-main` label was removed and re-added — `mergedAt` uses the
        *first* occurrence (unlike `leadTime.ts`'s `implement`-tracking, which
        deliberately uses the latest; this module tracks a different label with a
        different edge case, so assert the two are not conflated).
      - an issue with no `merged-main` event at all — absent from `entries`, not a
        zero-valued row.
      - a `from`/`to` window that excludes an otherwise-valid `mergedAt` — confirmed
        absent from `entries` and not counted in `total`.
      - a 30-day-span window produces daily buckets (`granularity: "day"`) and a
        91-day-span window produces weekly buckets (`granularity: "week"`), each with the
        right bucket boundaries.
      - a window with zero merges — `total: 0`, `entries: []`, `buckets` still present
        (all-zero), `granularity` still resolved correctly.
      - `previousTotal` reflects merges in the preceding same-length window, independent
        of `total`/`entries`/`buckets`, including the zero case (a previous window with
        no merges yields `previousTotal: 0`, not a special sentinel).

## 2. API endpoint

- [ ] 2.1 In `src/server/main.ts`, add a `/api/deployment-frequency` route following the
      exact `/api/lead-time` pattern: parse `repo`/`period` query params, 404 with the
      same error body when `metricsCache.get(repo)?.snapshot` is undefined, else resolve
      `{ from, to }` via `periodWindow(parsePeriod(...), new Date())` and respond with
      `computeDeploymentFrequency(cached.snapshot.issues, cached.snapshot.issueTimelines, from, to)`
      as JSON.

## 3. Wiring: Overview (stat tile + sparkline) and Delivery (trend chart + table)

- [ ] 3.1 Add `src/web/deploymentFrequency.ts` (pure, browser-safe, type-only import from
      `../server/metrics/deploymentFrequency.js`): a `formatDeploymentFrequencyDelta(total: number, previousTotal: number): string`
      helper — `"no prior data"` when `previousTotal === 0` and `total > 0`, `"no change"`
      when both are `0`, otherwise a signed count-vs-previous string (e.g. `"+3 vs previous period"`,
      `"-2 vs previous period"`), never a percentage (there is no clean percentage when
      `previousTotal` can be `0` — this sidesteps the divide-by-zero edge case entirely
      rather than special-casing it downstream).
- [ ] 3.2 Wire `src/web/pages/Overview.tsx`: alongside the existing lead-time `Section`,
      fetch `/api/deployment-frequency?repo=&period=` (same two-effect pattern already
      used for `/api/lead-time`) and add a "Deployment frequency" `Section` containing a
      `StatTile` (`label="Deployment frequency"`, `value={String(result.total)}`,
      `sub={result.total === 0 ? <HelperText>No changes merged in this period</HelperText> : <Sparkline points={result.buckets.map(b => b.count)} />}`,
      a `description`/secondary line from `formatDeploymentFrequencyDelta`). Check
      `StatTile`'s actual prop names in `src/components/primitives/StatTile.tsx` before
      wiring — use whatever slot it already exposes for a delta/description line rather
      than inventing a new prop.
- [ ] 3.3 Wire `src/web/pages/Delivery.tsx`: alongside the existing "Lead time" `Section`,
      fetch `/api/deployment-frequency` the same way (reuse the `repo`/`period` state
      already in this component) and add a "Deployment frequency" `Section` containing,
      when `result.total > 0`, a `TrendChart` of `buckets` (`points={result.buckets.map(b => ({date: b.date, value: b.count}))}`)
      plus a `DataTable` of `entries` (columns: issue link via `<a href={entry.url}>` —
      the same plain-anchor convention the Lead time table already uses, title, merged
      date), and when `result.total === 0` an explicit `HelperText`/empty-state message
      ("No changes merged in this period") instead of the chart.
- [ ] 3.4 Add `src/web/deploymentFrequency.test.ts` for `formatDeploymentFrequencyDelta`
      (zero-previous, zero-both, positive delta, negative delta).

## 4. Verification

- [ ] 4.1 `pnpm run typecheck && pnpm run test && pnpm run build` passes with no new
      lint/type errors, and no new colour literal or direct `palette.status` access was
      introduced (Rule 2/3).
