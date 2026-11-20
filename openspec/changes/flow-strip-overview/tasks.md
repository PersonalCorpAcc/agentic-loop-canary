# Flow strip hero cards + work item table + TV mode

Refs #162. Pre-refined issue — acceptance criteria below are copied from the issue body;
`skip_specs: true` (no explore/propose phase, per the fast path for refined issues).

## Scope decisions

- `FLOW_STYLES` / `styleFor("flow", ...)` already exist in `src/lib/statusStyles.ts` (#165) and
  already map every `FlowStageName` — the "exhaustive tone mapping" test target already exists
  and needs no new code, only a confirming test if one doesn't already cover it.
- "Stuck" threshold is a new, local constant in the new `src/web/flowStrip.ts` module (like
  `waitingOnPerson.ts`'s own local `STUCK_THRESHOLD_HOURS`) — this story doesn't exist yet when
  #165 wrote that one, and reusing it across modules isn't asked for.
- The work item table is a thin pure-mapping module (`src/web/flowTable.ts`), following
  `src/web/loopTable.ts`'s shape exactly: pure functions from domain data to
  `DataTableColumn<R>[]`/row id, unit-tested without mounting anything, consumed by `Overview.tsx`
  which instantiates `DataTable` directly (Rule 1: compose, don't recreate).
- Card UI lives in a new domain component `src/components/domain/FlowStrip.tsx` (exported from
  `src/components/domain/index.ts`), since it reads `FlowStageName`-typed data — domain is the
  only layer allowed to import app entity types.
- `@mui/x-charts`'s `SparkLineChart` is given this app's own line colour via its `colors`/`sx`
  props (reading `theme.palette` inside the component), not its own default palette.
- TV mode (`?tv=1`) is shell-level, not page-level: the nav rail and top bar live in
  `src/web/Shell.tsx`, so that's the file that reads the search param and conditionally omits
  them, mirroring the existing `period` URL-param pattern.

## Tasks

1. **Extend `src/server/flow.ts`'s `FlowItem`**
   - Add `labels: readonly string[]` and `prUrl?: string` to `FlowItem`.
   - Thread a PR's `html_url` through `linkedPrOf`/`buildFlowItem` into `prUrl`.
   - Thread the issue's labels through into `labels`.
   - Update `src/server/flow.test.ts` fixtures (`issue`, `pullRequest`, `snapshotOf` helpers and
     existing assertions) so they still pass with the new fields, and add a case asserting
     `prUrl`/`labels` are populated correctly from a linked PR / issue labels.

2. **New pure module `src/web/flowStrip.ts`**
   - A local `STUCK_THRESHOLD_HOURS` constant (separate from `waitingOnPerson.ts`'s own).
   - `medianAgeMs(items, now)` (or per-stage variant) computing the median of each item's
     time-in-current-stage from `enteredAt` — reuse `stageEnteredAt` from `src/web/waitingOnPerson.ts`
     rather than duplicating it.
   - A `cardDataOf(flow, now)` (or similarly named) function returning, per `FLOW_STAGES` entry in
     order: count, stage name/tone/icon (via `FLOW_STYLES`/`styleFor("flow", stage)`), sparkline
     series (that stage's `cfd` counts from the flow result), median age, `stuck` boolean, `held`
     count — covering every stage even when its count is 0.
   - `toggleStageFilter(current, stage)`: pure click-to-filter logic — returns the stage if
     previously unselected/different, `undefined` (clear) if clicking the already-selected stage.
   - Unit tests (`src/web/flowStrip.test.ts`): fixed `enteredAt` timestamps → expected median;
     zero-item stage → `count: 0`, not omitted; `toggleStageFilter` select/reselect/clear
     behaviour.

3. **New pure module `src/web/flowTable.ts`**
   - `estimateOf(labels)`: parses an `sp-N` label into `N`, `undefined` when absent/unparseable.
   - `lastRunFor(issueNumber, runs)`: matches a `LoopRun` to a flow item the way `runs.ts` already
     matches subjects/carried issues (`run.subject === "#"+issue" || run.carriedIssues?.includes(issue)`),
     most recent first.
   - `flowTableColumns(now)`/`flowTableRows(items, runs, now)` (naming flexible) producing
     `DataTableColumn<FlowTableRow>[]` and row data for: title, stage (`StatusBadge kind="flow"`),
     age-in-stage (reuse `humanizeAge` — export it from `WaitingOnPersonList.tsx` if still private),
     estimate, PR link, last-run outcome (`describe()` + `StatusBadge kind="loop"`) — age and
     estimate sortable, title searchable (mirrors `loopTable.ts`'s `sortable`/`searchable` column
     flags and `xTableRowId`/`xTableOf`-style helpers).
   - Unit tests (`src/web/flowTable.test.ts`): `estimateOf` parsing (present/absent/malformed),
     `lastRunFor` matching, column sortability/searchability flags, row shape for a representative
     item.

4. **New domain component `src/components/domain/FlowStrip.tsx`**
   - Renders one card per `cardDataOf` entry, in `FLOW_STAGES` order, wrapped in a flex container
     that wraps (not shrinks) across viewport widths (per the 4K→1280px edge case).
   - Each card: count, stage name, `SparkLineChart` (from `@mui/x-charts`, coloured from
     `theme.palette`/`useStatusTone`), a coloured age indicator.
   - Stuck cards: amber glow (border/box-shadow via `useStatusTone("warn")`) plus an icon and a
     text label — never colour alone.
   - Held cards: an additional red badge with a count (`Badge tone="err"` or `StatusBadge`-style,
     additive to the base state, not replacing it).
   - Click toggles selection (calls back up with `toggleStageFilter`'s result); selected card
     shows an active state (e.g. border/elevation change).
   - Respects `prefers-reduced-motion` (`useMediaQuery("(prefers-reduced-motion: reduce)")`):
     skips count-transition and card-enter animations entirely when set, not merely shortened.
   - Loading (`skeleton`) and fetching (dimmed-previous-snapshot) states, matching `DataTable`'s
     own `loading`/`fetching` convention, for the "`/api/flow` unreachable" edge case.
   - Export it from `src/components/domain/index.ts`.

5. **Rewrite `src/web/pages/Overview.tsx`**
   - Fetch `/api/repo` once and `/api/flow?repo=&period=` keyed on `[repo, searchParams]`,
     following `Delivery.tsx`'s pattern; also fetch `/api/runs` for the table's last-run column.
   - Poll `/api/flow` on an interval so TV mode keeps refreshing without a manual reload; keep the
     previous snapshot visible (dimmed via `fetching`) while a refetch is in flight, and only show
     the skeleton before any snapshot has ever loaded.
   - Hold `selectedStage` state; pass it and `toggleStageFilter` into `FlowStrip`; filter the
     `DataTable` rows to the selected stage (or all rows when `undefined`).
   - Render `FlowStrip` then a `DataTable` built from `flowTable.ts`'s columns/rows.

6. **TV mode in `src/web/Shell.tsx`**
   - Read a `tv` search param (`"1"` → on), mirroring `src/shared/period.ts`'s `parsePeriod`
     pattern but as a simple boolean parse.
   - When on: omit the nav rail (`RailFrame`) and `TopBar`, let the `Outlet` fill the viewport
     (remove/reduce its padding), and render an always-reachable, minimal control to exit TV mode
     (e.g. a small floating icon button that clears the `tv` param).
   - When off: add a toggle-on control to `TopBar` (beside `PeriodSelector`) that sets `tv=1`.

7. **Dependency**
   - `pnpm add @mui/x-charts` (frozen-lockfile-respecting; run with
     `NODE_OPTIONS="--use-env-proxy"` set in this sandbox).

8. **Verification**
   - `pnpm run typecheck && pnpm run test && pnpm run build` all green.
   - `pnpm run lint --fix` restricted to files touched by this change.
