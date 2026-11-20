## 1. `classifyFlowStage` and the stage table

- [ ] 1.1 Add `src/server/flow.ts` with `FlowStageName`, the linked-PR shape (`labels`, `state`, optional `reviewDecision` for a later story), and `classifyFlowStage(labels, linkedPr?, issueState?)` returning `{ stage, held }` per the #159 stage table. Reuse `blockingLabelOf` from `src/server/stages.ts` for the `held` overlay (`hold` / `rollback` only, not `hotfix`).
- [ ] 1.2 Add `src/server/flow.test.ts` covering `classifyFlowStage` against each row of the table (using real label combinations from this repository's own issues, e.g. #159's children) plus the `held` overlay independent of stage.

## 2. Stage history replay

- [ ] 2.1 In `src/server/flow.ts`, add `TimelineEvent` and `replayFlowStageHistory(events, current)`, replaying `labeled`/`unlabeled` (and `closed`/`reopened`) events through `classifyFlowStage`, deduplicating consecutive non-changing entries, with the single-entry fallback for an issue with no timeline events.
- [ ] 2.2 Add `stageAt(history, atISO)` for looking up the classified stage at an arbitrary point in time.
- [ ] 2.3 Tests in `flow.test.ts`: replaying a recorded timeline reproduces the expected `{stage, enteredAt}` sequence, consecutive non-changing events collapsed, and the no-events fallback.

## 3. Cached timeline events and the extended snapshot

- [ ] 3.1 Extend `ApiIssue` (`src/server/metrics.ts`) with `created_at`, extend `ApiPullRequest` with `body` and `labels` (already present on the forge response; only the type was narrow).
- [ ] 3.2 Add `fetchIssueTimeline(repo, issueNumber)` to `metrics.ts`, paginating past 100 events, and wire it into `fetchRepoSnapshot` as `RepoSnapshot.issueTimelines: Record<number, TimelineEvent[]>`.
- [ ] 3.3 Update `metrics.test.ts` fixtures for the new required `ApiIssue.created_at` field.

## 4. CFD day-bucketing and `buildFlow`

- [ ] 4.1 In `flow.ts`, add `FlowItem`, `CfdBucket`, `cfdBuckets(items, from, to)` (explicit `0` for a stage with no items on a day), and `buildFlow(snapshot, period, now?)` assembling `FlowItem[]` (current stage + replayed history, linked PR resolved via `carriedIssuesOf`) and the day-bucketed CFD.
- [ ] 4.2 Add a local `parsePeriod(raw)` in `flow.ts` for the `period` query string (`"Nd"` / `"all"`, default 30 days) as a stand-in until `src/shared/period.ts` lands in #158; note the follow-up in a comment.
- [ ] 4.3 Tests in `flow.test.ts`: CFD day-bucketing against a fixed set of items with known histories, including a day with zero items in a stage.

## 5. `/api/flow` endpoint

- [ ] 5.1 Add a `/api/flow?repo=&period=` branch to `src/server/main.ts` reading only `metricsCache`, returning `{ items, cfd }` built by `buildFlow`, 404 when the repository has no cached snapshot yet, never a live forge call.
