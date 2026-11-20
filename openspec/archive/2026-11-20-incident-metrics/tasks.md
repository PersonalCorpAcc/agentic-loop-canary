## 1. Shared timeline types

- [x] 1.1 Add `src/server/metrics/timeline.ts` with the `IssueTimeline`/`LabelEvent` shape (matching what `deploymentFrequency.ts` introduces under #143, so the two fold together once that lands) and the `hold`/`rollback` incident-label helpers (`carriesHotfix`, `everCarriedIncidentLabel`) both metrics below share.

## 2. Change failure rate

- [x] 2.1 Add `src/server/metrics/changeFailureRate.ts` with `computeChangeFailureRate(timelines, mergedLabel, since, until)`: denominator is every issue (excluding ones carrying `hotfix`) whose `mergedLabel` arrived in `[since, until]`; numerator is the subset whose timeline ever carried `hold` or `rollback`.
- [x] 2.2 Vitest fixtures and tests in `changeFailureRate.test.ts` covering a clean shipped change, a `rollback`-labelled change, and the `hotfix` exclusion -- exact rate assertions, no network call.

## 3. Time to restore

- [x] 3.1 Add `src/server/metrics/timeToRestore.ts` with `computeTimeToRestore(timelines, since, until)`: one sample per `hold`/`rollback` label-add-then-clear pair (tracked per label name, so a held-released-held-again issue yields two samples and a hold-then-later-rollback issue yields two independent samples), attributed to the day the label was cleared; a still-open incident contributes no sample.
- [x] 3.2 Vitest fixtures and tests in `timeToRestore.test.ts` covering one pair, two sequential pairs on the same issue, two different-label pairs, and a still-open incident excluded from the period -- exact day-duration assertions, no network call.

## 4. Scope note

- [x] 4.1 Document in the PR description that the Overview/Delivery UI (tiles, sparklines, trend chart, linked table) from the issue's acceptance criteria is deferred: `#142` (dashboard shell) and `#143` (deployment-frequency timeline fetch, chart components) are not yet merged to this branch's base, so there is no Overview/Delivery surface or timeline-fetching module to wire these metrics into yet. This change ships the tested computation layer the issue itself calls out as independently gated ("Tested, deterministic"); UI wiring follows once those land.
