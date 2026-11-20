# Tasks: Time-in-stage breakdown and the "waiting on a person" list

Refs #165. Pre-refined issue — acceptance criteria below are the source of truth. Blocked-by
#161 ("flow-stage-engine") has already landed (`src/server/flow.ts`, archived change
`2026-11-20-flow-stage-engine`); #162 (the flow strip itself) has not, so there is no existing
`useStatusTone` stage mapping or "stuck" component to reuse yet — this change adds the minimal
versions of both rather than waiting on #162.

Scope decisions, made so implementation does not re-litigate them:

- The metrics cache (`src/server/metrics.ts`) does not fetch issue/PR comments today, and
  extending it to do so is out of scope for this change. The "question or review request text"
  column always renders its muted "no detail available" caption for now — the edge case is the
  only path exercised, exactly as the acceptance criteria allows ("where the metrics cache
  exposes one").
- `replayFlowStageHistory` (#161) never emits `validating` / `awaiting-review` entries (a
  documented limitation: those depend on the linked PR's state, which the issue timeline does
  not carry). The duration-per-stage computation is generic over whatever stages *do* appear in
  a `history` array; stages absent from history simply contribute zero to the rendered bar. This
  keeps "the full set of durations always sums to the item's total lead time" true for whatever
  history actually contains, without inventing data the cache does not have.
- The "stuck" age threshold is a new, local constant (`STUCK_THRESHOLD_HOURS`), not a reuse of
  a #162 constant that does not exist yet.

## 1. Server: per-stage durations and the period window on `/api/flow`

- [ ] 1.1 In `src/server/flow.ts`, add `stageDurations(history: readonly FlowStageEntry[], now: string): Record<FlowStageName, number>`: for each entry, the duration (ms) is the gap to the next entry's `enteredAt`, or to `now` for the last entry; stages never present in `history` get `0`. Zero-gap entries (two entries with the same `enteredAt`) must still contribute an explicit `0`, never be dropped from the record.
- [ ] 1.2 Thread `now` into `buildFlowItem` (currently `buildFlowItem(issue, snapshot)`, called from `buildFlow` which already has a `now: Date` parameter) and attach `durationsMs: Record<FlowStageName, number>` to `FlowItem`, computed via `stageDurations(history, now.toISOString())`.
- [ ] 1.3 Add `from: string` and `to: string` (ISO) to `FlowResult`, populated from the `from`/`to` `Date`s `buildFlow` already computes, so a caller can filter "shipped items in the period" without re-deriving period math (`src/server/flow.ts`'s `parsePeriod` and `src/shared/period.ts` are already two separate parsers — do not add a third; just pass through the window `buildFlow` already resolved).
- [ ] 1.4 Tests in `src/server/flow.test.ts`: `stageDurations` against a fixed history fixture, including a zero-duration entry (the sliver edge case) and confirming the returned record's values sum to `now - history[0].enteredAt`; `buildFlow`'s result carries matching `from`/`to` for both a day-count period and `all`.

## 2. `FlowStageName` → tone mapping

- [ ] 2.1 In `src/lib/statusStyles.ts`, add `import type { FlowStageName } from "../server/flow.js";` (type-only — this module stays React-free and must not pull server runtime code into the web bundle) and `FLOW_STYLES: Record<FlowStageName, StatusStyle>` covering all nine stages (`backlog`, `specifying`, `needs-answers`, `ready`, `building`, `validating`, `awaiting-review`, `deploying`, `shipped`), each with a tone, icon and label, following the existing `JOB_STYLES` / `STAGE_STYLES` / `LOOP_STYLES` pattern (a total `Record`, never a partial map). Suggested tones: `backlog`/`ready` neutral, `specifying`/`building`/`validating` info, `needs-answers`/`awaiting-review` warn, `deploying`/`shipped` ok — adjust labels/icons to match the existing maps' terseness.
- [ ] 2.2 Extend `styleFor`'s overload set with a `"flow"` kind (`styleFor(kind: "flow", state: FlowStageName): StatusStyle`), mirroring the existing `"job"` / `"stage"` / `"loop"` branches, so call sites use the same door as every other domain mapping (AGENTS.md Rule 3).

## 3. Frontend: pure computation modules (no rendering, matches `loopTable.ts`'s convention)

- [ ] 3.1 Add `src/web/timeInStageBar.ts`: `BAR_SEGMENTS` (the five segment stages in acceptance-criteria order: `specifying`, `building`, `validating`, `awaiting-review`, `deploying`), a `READABLE_BAR_LIMIT` constant (pick a reasonable default, e.g. 12), `shippedInPeriod(items: readonly FlowItem[], from: string, to: string): FlowItem[]` (stage `"shipped"` and the item's last `history` entry's `enteredAt` within `[from, to]`), and `timeInStageRows(items: readonly FlowItem[], limit = READABLE_BAR_LIMIT)` returning either `{ mode: "individual"; rows: BarRow[] }` (one `BarRow` per item, each `{ issue, title, url, segments: { stage, ms }[] }` in `BAR_SEGMENTS` order, reading `ms` out of `item.durationsMs`) or `{ mode: "averaged"; row: BarRow; count: number }` (segment `ms` averaged across all shipped items) when there are more shipped items than `limit`. Only type-import from `src/server/flow.ts` (`FlowItem`, `FlowStageName`) — never a value import, so this stays browser-safe.
- [ ] 3.2 Add `src/web/timeInStageBar.test.ts`: fixed `FlowItem`/`durationsMs` fixtures proving segment order, the zero-duration sliver surviving as an explicit `0` (not dropped), the individual/averaged mode switch at the limit boundary, and the averaged row's per-segment mean.
- [ ] 3.3 Add `src/web/waitingOnPerson.ts`: `WAITING_STAGES = ["needs-answers", "awaiting-review"] as const`, `STUCK_THRESHOLD_HOURS` constant (pick a reasonable default, e.g. 48), `stageEnteredAt(item: FlowItem): string` (the last `history` entry's `enteredAt` — the best available proxy for `awaiting-review`/`validating`, which `history` cannot represent directly per #161's documented limitation; comment this), and `waitingRows(items: readonly FlowItem[], now: Date)` returning one row per item currently in `WAITING_STAGES`, sorted oldest-`enteredAt`-first, each `{ issue, title, url, stage, enteredAt, ageMs, stuck, questionText }` (`stuck = ageMs > STUCK_THRESHOLD_HOURS * 3_600_000`; `questionText` always `undefined` for now — see the scope decision above).
- [ ] 3.4 Add `src/web/waitingOnPerson.test.ts`: fixed `enteredAt` values proving oldest-first sort order and the `stuck` flag flips exactly at the threshold.

## 4. Frontend: rendering

- [ ] 4.1 Add `src/components/domain/TimeInStageBar.tsx` (domain category: it reads `FlowStageName`/`BarRow` shapes): renders `timeInStageRows`' output as one horizontal stacked bar per row (or the single averaged bar), each segment coloured via `useStatusTones()` keyed through `FLOW_STYLES[stage].tone` (never `palette.status` directly — Rule 3), a minimum rendered width per segment so a zero-duration sliver is still visible, and — only in averaged mode — a caption reading "averaged over {count} items". Export it from `src/components/domain/index.ts` (create the barrel if it does not exist yet, following the other categories' `index.ts` pattern).
- [ ] 4.2 Add `src/components/domain/WaitingOnPersonList.tsx`: renders `waitingRows`' output, each row showing age (humanised), an external link to the issue/PR (`<a href={row.url}>`, the same plain-anchor pattern `loopTable.ts` uses for GitHub links — not `AccentLink`, which is for in-app routes), the question/review text or a muted "no detail available" caption (`HelperText` or `MicroText`) when `questionText` is undefined, and the stuck row visually flagged (icon + warn-tone label via `StatusText`, never colour alone — Rule 3/AGENTS.md accessibility rule). Export it from `src/components/domain/index.ts`.
- [ ] 4.3 Wire both into `src/web/pages/Delivery.tsx`: fetch `/api/repo` for the repo and read `period` from `useSearchParams` (same pattern `Shell.tsx`'s `PeriodSelector` already writes), fetch `/api/flow?repo=&period=`, and render two `Section`s — "Where time goes" (`TimeInStageBar`) and "Waiting on a person" (`WaitingOnPersonList`) — replacing the current empty `<PageHeader title="Delivery" />`-only body (keep the `PageHeader`).

## 5. Verification

- [ ] 5.1 `pnpm run typecheck && pnpm run test && pnpm run build` passes with no new lint/type errors, and the ESLint `no-restricted-syntax` rule for `palette.status` access is not triggered by the new components.
