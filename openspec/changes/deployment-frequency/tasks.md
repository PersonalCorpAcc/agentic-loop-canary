# Tasks: Deployment frequency: stage-arrival timeline + first trend chart

Refs #143. Pre-refined issue — acceptance criteria below are the source of truth.

**Scope note:** #143 is blocked by #142 (dashboard shell: routing, Overview/Delivery
pages). #142 is not yet merged into `dev` — its branch exists
(`agent/142-44771710525/dashboard-shell`) but is unreviewed and unavailable to this
run (no git credentials, no fetch/checkout of other branches). `src/web` today has
no `Overview.tsx`, `Delivery.tsx`, or router: building them here would duplicate
#142's own deliverable with unreviewed content. This change therefore implements
every part of #143 that does not require those pages — the timeline fetch, the
stage-arrival classifier, `computeDeploymentFrequency` (fully specified and
tested), the metrics API endpoint, and the two new dependency-free chart
components — and stops short of mounting them on Overview/Delivery. That wiring
is one function call once #142 lands and is called out as follow-up.

- [ ] 1. Add `src/server/metrics/deploymentFrequency.ts`: a stage-arrival
      classifier (`stageArrivalOf`) that reads a `labeled` event's `created_at`
      off an issue's timeline for the `merged-{finalStage}` label (final stage
      from `readStageBranches` in `src/server/strategy.ts`, i.e. the last entry
      of `STAGE_BRANCHES` — `main` today); UTC day/week bucketing
      (`bucketKeyFor`, documented inline so a reviewer can verify by hand);
      `granularityFor` (daily for ≤30-day periods, weekly above, so a 90-day
      chart never renders 90 bars); the pure, fully-typed
      `computeDeploymentFrequency` that buckets a set of issue timelines into
      one entry per bucket across `[since, until]` (zero-filled, so a quiet
      period reads as explicit zeros rather than missing points) with the
      issue numbers behind each count; and `compareToPreviousPeriod` (absolute
      delta + percentage, or an explicit "no prior data" result when the
      previous period had zero merges — never a divide-by-zero). Also add the
      network half: `fetchIssueTimeline` (`GET /repos/{repo}/issues/{number}/events`,
      paginated) and `listIssuesWithLabel` (`GET /repos/{repo}/issues`, by
      label), read-only and unauthenticated-capable like `stages.ts` /
      `runs.ts`.

- [ ] 2. Tests (`src/server/metrics/deploymentFrequency.test.ts`, Vitest,
      network-free): a fixture of real timeline events built from this
      repository's own history (issues #8, #47, #96, #97, #107 — their real
      `merged-main` label timestamps, fetched via the GitHub API on
      2026-11-20), asserting exact per-bucket counts and the issue list behind
      each, in particular that the four issues merged into `main` within the
      same batched promotion on 2026-09-22 count as 4 on that day, not 1.
      Cover: day vs. week granularity, zero-merge buckets/period, and the
      previous-period "no prior data" edge case.

- [ ] 3. Add `Sparkline` and `TrendChart` to `components/data-display/` (no
      chart library — small dependency-free SVG, per the issue's grounding),
      in both `docs/frontend-theme-kit/components/data-display/` (the kit) and
      `src/components/data-display/` (the installed copy), plus a new
      `data-display/index.ts` barrel in both locations (one did not exist
      yet) exporting `DataTable`, `KeyValueGrid`, `Sparkline`, `TrendChart`.
      `Sparkline`: tiny inline line for a `StatTile`'s `sub` slot. `TrendChart`:
      larger chart with axis labels and a per-point tooltip (exact count +
      date). Both render an explicit empty state ("No changes merged in this
      period") when total is zero, never a flat zero-line. Colour only via
      `useTheme()` (§2.2c) — no literals.

- [ ] 4. Add `GET /api/metrics/deployment-frequency?period=7d|30d|90d` to
      `src/server/main.ts`, composing `listIssuesWithLabel` +
      `fetchIssueTimeline` + `computeDeploymentFrequency` +
      `compareToPreviousPeriod` for the requested period and its equal-length
      previous period. This is the integration point the next step (and the
      lead-time / change-failure-rate children of #139) reuses.

- [ ] 5. Follow-up (not done here, blocked on #142): mount a `StatTile` +
      `Sparkline` on `Overview.tsx` and a `TrendChart` + `DataTable` (linked to
      each issue) on `Delivery.tsx`, once those pages exist.

- [ ] 6. Verify: `pnpm run typecheck && pnpm run test && pnpm run build`, then
      `pnpm run lint --fix` over changed files.
