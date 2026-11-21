# Tasks: Flow strip hero cards + work item table + TV mode

Refs #162. Pre-refined issue — acceptance criteria below are the source of truth. Builds on
current `dev`'s `MetricsCache`/`/api/flow` (`src/server/flow.ts`, `src/server/main.ts`), the
`Sparkline`/`TrendChart` components, `DataTable`, and `src/lib/statusStyles.ts` /
`useStatusTone` — extends them, does not duplicate them.

- [ ] 1. Add `pnpm add @mui/x-charts` (first use in the app, per the acceptance criteria).

- [ ] 2. Extend `FlowItem` in `src/server/flow.ts` with the fields the strip/table need that
      it does not carry yet: `labels` (for the `sp-N` estimate), `prUrl` (the linked pull
      request's `html_url`, where one exists), and `lastRun` (the most recent `LoopRun` from
      `snapshot.runs` whose subject or carried-issues names this issue). Thread these through
      `buildFlowItem`. Update `src/server/flow.test.ts` for the new fields.

- [ ] 3. `src/web/flowStrip.ts` (pure, type-only imports from `server/flow.js`, same
      convention as `timeInStageBar.ts` / `waitingOnPerson.ts`): a `median()` helper, a
      `StageCard` shape (stage, count, sparkline series off `flow.cfd`, median age-in-stage
      off `stageEnteredAt` reused from `waitingOnPerson.ts`, `stuck` off the existing
      `STUCK_THRESHOLD_HOURS`, `heldCount`), a `flowStripCards()` builder, and a
      `toggleStageFilter()` pure selection helper (select narrows, selecting the same stage
      again clears). Also a small `estimateOf(labels)` parser for `sp-N`.
      `src/web/flowStrip.test.ts`: median on a fixed set of timestamps, click-to-filter
      toggle, stuck/held flagging, empty-stage (zero items, stage still present).

- [ ] 4. `src/components/domain/FlowStrip.tsx`: nine connected cards, left to right in
      `FLOW_STAGES` order, each with count, stage name, an `@mui/x-charts` `SparkLineChart`
      themed off the MUI theme (not its own palette), and an age indicator coloured via
      `useStatusTone`. Stuck: amber glow + icon + text label (never colour alone). Held: a
      red badge with a count, additional to the base state. Zero-item stage still renders
      `0`. Selecting a card calls back with the clicked stage; the selected card shows an
      active state. Skip count-transition/card-enter animation under
      `prefers-reduced-motion`. Wrap/scroll horizontally rather than shrinking cards below a
      readable size (4K down to 1280px). Export from `src/components/domain/index.ts`.

- [ ] 5. Overview page (`src/web/pages/Overview.tsx`): fetch `/api/flow` (reusing the same
      `repo`/`searchParams`-period pattern `Delivery.tsx` already uses), render `FlowStrip`
      above a `DataTable<FlowItem>` work item table — columns: title (link), stage (pill via
      `StatusBadge kind="flow"`), age-in-stage, estimate (`sp-N`), PR link, last run outcome
      (`StatusBadge kind="loop"` + `describe()`) — sortable on age/estimate, searchable on
      title. Clicking a card filters the table to that stage (`toggleStageFilter`); a second
      click on the same card clears it. First load shows the table's own `loading` skeleton;
      a refetch (period change) uses `fetching`; `/api/flow` unreachable keeps the previous
      snapshot dimmed rather than a blank page.

- [ ] 6. TV mode: `?tv=1` in the URL (same `useSearchParams` pattern `period` already uses).
      `src/web/Shell.tsx` hides the nav rail and top bar when `tv=1` and lets the routed page
      fill the viewport; polling (`/api/flow`) continues unchanged. A toggle control on the
      Overview page flips the param; it stays reachable while TV mode is active so a viewer
      can exit it.

- [ ] 7. Tests: `FLOW_STYLES`'s `Record<FlowStageName, StatusStyle>` already makes the
      per-stage mapping exhaustive at compile time (`src/lib/statusStyles.ts`) — no new test
      needed there, only confirm it still compiles with any new stage-shaped code. Cover the
      edge cases named in the issue (empty stage, `/api/flow` unreachable) in
      `flowStrip.test.ts` / an Overview-level test where one is practical.

- [ ] 8. Verify: `pnpm run typecheck && pnpm run test && pnpm run build`, then
      `pnpm run lint --fix` over changed files.
