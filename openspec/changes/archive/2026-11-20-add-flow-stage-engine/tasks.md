## 1. Period helper (dependency, not yet on `dev`)

- [x] 1.1 Add `src/shared/period.ts` and `src/shared/period.test.ts`, the `?period=` contract PR #158 establishes, copied as-is since `/api/flow` depends on it and it has not landed on `dev` yet.

## 2. Classifier

- [x] 2.1 In a new `src/server/flow.ts`, add `FlowStageName` (the 9-value stage table) and `FlowItem`, deliberately not reusing `Stage`/`StageBlock` from `src/shared/types.ts` -- a different concept (deployment-chain branches, not workflow stage).
- [x] 2.2 Add `classifyFlowStage(labels, linkedPr?, requiredApprovalMissing?)` returning exactly one `FlowStageName` per the table in the issue, plus `held` computed from the `hold`/`rollback` subset of `blockingLabelOf` (not `hotfix`).
- [x] 2.3 Document the two known limitations directly in the module comment: an issue closed without `merged-main` classifies `shipped` (no reliable abandoned-vs-done signal), and replay uses one `linkedPr` snapshot across history since the timeline does not report a PR's labels at each past moment.

## 3. Stage history

- [x] 3.1 Add `listIssueTimeline` in `metrics.ts` (or `flow.ts`, calling `metrics.ts`'s fetch helpers) that pages through `/issues/{number}/timeline` fully before returning.
- [x] 3.2 Add `replayHistory`: replay `labeled`/`unlabeled` events through `classifyFlowStage`, deduping consecutive non-changing stages, falling back to a single `created_at` entry from current labels when there are no events.

## 4. Cache and endpoint

- [x] 4.1 Extend `ApiPullRequest` with `body`/`labels` (already free on the pulls-list response) and `ApiIssue` with `closed_at`, add `ApiTimelineEvent`, extend `RepoSnapshot` with `issueTimelines`, and populate it in `fetchRepoSnapshot` with per-issue error tolerance.
- [x] 4.2 Add `/api/flow?repo=&period=` in `src/server/main.ts`, built only from `metricsCache.get(repo)` plus `parsePeriod`, returning `{ items, cfd }` with one CFD entry per day in the period and explicit `0` counts for empty stages.

## 5. Tests

- [x] 5.1 `src/server/flow.test.ts`, fixtures from real issues in this repository per row of the stage table, plus the `held` overlay, history replay with dedup, and CFD day-bucketing.
