# Tasks: Delivery dashboard shell (dark theme, routing, nav rail, top bar)

Refs #142. Pre-refined issue — acceptance criteria below are the source of truth.

- [ ] 1. Add dark-mode tokens to `src/theme/palette.ts` (a second `PaletteOptions`, e.g.
      `darkPalette`, built from the existing semantic slots) and wire a mode switch into
      `src/theme/index.ts` so the shell can create a dark theme. Audit every `common.white`
      literal in `src/theme/components.ts` the kit's README warns about, and fix any pairing
      that would fall below WCAG AA (4.5:1 body text, 3:1 large text) under dark mode.
      No colour literal may land outside `src/theme/` (`AGENTS.md` Rule 2).

- [ ] 2. Add `react-router-dom`'s `BrowserRouter` to `src/web/main.tsx` (the theme kit's own
      step 5 shows the ordering: `ThemeProvider` > `CssBaseline` > `BrowserRouter`).

- [ ] 3. Build the shell: a nav rail (via the kit's `RailFrame` / `RailNode`,
      `src/components/layout/RailFrame.tsx` / `src/components/primitives/RailNode.tsx`) with
      three entries — Overview (`/`), Delivery (`/delivery`), and Loop (`/loop`) — and a top
      bar. Put the shell in `src/web/Shell.tsx` (or similar) and mount it as the route layout
      in `src/web/main.tsx` / a new `src/web/routes.tsx`, replacing the direct `<App />` render.

- [ ] 4. Create `src/web/pages/Overview.tsx` (empty page component) and
      `src/web/pages/Delivery.tsx` (empty page component). Route `/` to Overview and
      `/delivery` to Delivery. Both render inside the shell with the correct rail entry active.

- [ ] 5. Move `src/web/App.tsx`'s existing content (the stage list + run log) behind the
      `/loop` route as `src/web/pages/Loop.tsx` (or keep `App.tsx` and route `/loop` to it) —
      retire it from the root path without deleting it. Root (`/`) must render Overview, not
      the old log.

- [ ] 6. Add a `GET /api/repo` endpoint to `src/server/main.ts` that returns
      `{ "owner": string, "name": string }` parsed from the same `LOOP_REPO` env var
      `src/server/runs.ts` / `stages.ts` already read (default
      `PersonalCorpAcc/agentic-loop-canary`). Extract the parsing so it is unit-testable
      (e.g. a small pure function in `src/shared` or `src/server`).

- [ ] 7. Top bar: fetch `/api/repo` and render the owner/name as read-only text; on fetch
      failure show "repository unavailable" text (mirror the existing
      `catch(() => setStrategy(null))` pattern in `App.tsx`) rather than blank space.

- [ ] 8. Top bar period selector (Last 7 days / Last 30 days / Last 90 days) whose selected
      value lives in the URL query string as `?period=7d|30d|90d`, read/written via
      `react-router-dom`'s `useSearchParams`, not only component state. No period in the URL
      defaults to `30d` and the default is written into the URL rather than left absent. A
      direct link such as `/delivery?period=90d` must restore that period on first render.
      Write the period parsing/validation as a small pure, unit-testable function.

- [ ] 9. Tests (Vitest, `*.test.ts` beside what they test, per `AGENTS.md`): the `/api/repo`
      owner/name parsing function, and the period query-string parse/default/validate
      function. Cover the edge cases named in the issue (missing period, invalid period).

- [ ] 10. Verify: `pnpm run typecheck && pnpm run test && pnpm run build`, then
      `pnpm run lint --fix` over changed files.
