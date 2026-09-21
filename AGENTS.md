# loopscope

A live view of what the agentic loop is doing: routes, outcomes, pull requests and the
things waiting for a person, read from the repository that runs the loop.

This repository is built *by* the loop it watches. Every change here arrives as an issue,
is implemented by an agent, and lands through the same gate and the same rules the product
sells. That is the point: the dashboard and its evidence are the same thing.

## Shape

- `src/shared` — the vocabulary both halves share, including the parser for the loop's own
  outcome line (`outcome=... route=... reason=...`, FR-058).
- `src/server` — reads runs from the forge and pushes them over a WebSocket. No database:
  everything it serves is something the loop already wrote.
- `src/web` — React. Anything that asked for a person sorts first; a dashboard that sorts by
  time buries the one row somebody has to act on.

## Rules

- TypeScript strict, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Tests are Vitest and live beside what they test. Fixtures come from real runs of this
  loop rather than from invented data: a fixture written to match the parser proves only
  that the parser matches itself.
- British spelling in prose. Dates `DD/MM/YYYY`.
- `pnpm run typecheck && pnpm run test && pnpm run build` is the verification, and it is what
  CI runs.

## Frontend design system — READ BEFORE WRITING ANY UI

This app uses the **RiskPoint MUI v6 design system**. It is not a starting
point to be customised per-page; it is the contract.

- Tokens: `src/theme/` (palette, typography, shape, shadows, component defaults).
- Components: `src/components/{primitives,layout,containers,data-display,inputs,domain,feedback}/`.
- Full handbook, including the four ways to read a token and the trap list:
  `docs/frontend-theme-kit/README.md`. **Read §2 before writing a new component.**

### Rule 1 — compose before you create

Before writing any new component, check the catalogue in the handbook (§4) and
the barrels in `src/components/*/index.ts`. 30 components already exist.

Most "new component" work is really one of:

- an existing primitive with different props (`Pill`, `StatTile`, `MetricValue`,
  `Badge` all take variants),
- an existing layout container with different children (`Section`, `PageHeader`,
  `Toolbar`, `RailFrame`, `ThreePaneLayout`, `CollapsibleCard`),
- `DataTable` — **read it before writing any table.** It already handles sort,
  search, keyset/offset pagination, skeleton loading vs refetch, empty states.

State what you checked and why it did not fit before adding a component. If the
answer is "it fits but I want different spacing/colour", it fits — pass `sx`.

### Rule 2 — no colour literals outside `src/theme/`

No `#rrggbb`, no `rgb()`/`rgba()`, no named CSS colours, in any component.
This is absolute. A literal works today and silently stops following the
palette tomorrow.

Use the **semantic slot**, not the ramp shade behind it:

| Need | Use | Never |
|---|---|---|
| hairline, border, divider | `divider` | `paper.rule`, `#e2e8f0` |
| emphasised / control border | `border.strong` | `paper.ruleStrong` |
| muted / secondary text | `text.secondary` | `brand[400]` |
| card surface | `background.paper` | `#ffffff` |
| recessed panel, table header | `surface.muted` | `paper.muted` |
| primary ink, fills, active nav | `brand.main` | `#122933` |
| any status colour | `useStatusTone(tone)` | `palette.status.*`, `error.main` |

For transparency use `alpha(theme.palette.x, 0.12)` from `@mui/material/styles`.
Never concatenate hex alpha onto a token string — it breaks the moment the token
is an `rgb()` or named value.

The one sanctioned exception is a deliberately document-first stylesheet (e.g. a
print export that must not follow the app palette). One file, commented as such.

### Rule 3 — status colour has exactly one door

`theme.palette.status.*` is read **only** by `useStatusTone` /
`useStatusTones`. Badges, table cell text, progress bars, threshold colouring —
all call the hook. Enforced by the `no-restricted-syntax` ESLint rule; do not
add an `eslint-disable` to get around it.

Every status ships **colour + icon + text label**, never colour alone — it has
to survive a greyscale screenshot and a colour-blind reader. Domain state →
tone mapping lives in `src/lib/statusStyles.ts` as `Record<State, StatusStyle>`
(never a partial map plus a fallback, so a new state is a compile error rather
than a blank badge).

### Rule 4 — `sx` numbers are multiplied, and the multiplier varies

| `sx` prop | Multiplier | `1` means |
|---|---|---|
| `p`, `m`, `gap`, `px`, `mt`, … | `spacing` = **4** | 4px |
| `borderRadius` | `shape.borderRadius` = **8** | 8px |
| `width`, `height`, `fontSize` | none | 1px |

`borderRadius: 8` in `sx` is 64px. Use `borderRadius: 1`.

Spacing base is **4**, not MUI's default 8 — every component assumes it. Inside
`theme/components.ts` `styleOverrides` there is no multiplier at all; those are
raw CSS pixels. Check which file you are editing.

### If you do need a new component

1. **Place it by what it knows.** `primitives/` = MUI only, no domain types, no
   fetching. `layout/` = scaffolding. `containers/` = stateful in-page chrome.
   `data-display/` = read-only renderers. `inputs/` = form controls.
   `domain/` = the only category that may import app entity types.
   `feedback/` = async/empty/error panels.
2. **Dependencies run one way**: a component may import from its own category
   and from categories above it in that list. Never downward, never sideways
   into `domain/`.
3. **Export it from that category's `index.ts`.** Call sites import
   `@/components/primitives`, never a deep path.
4. **A shared container needs ≥2 real call sites.** One caller is not a
   component, it is a section of that page.
5. **Tokens only** — Rules 2–4 apply. No new `theme/` entry unless the value is
   genuinely a new design decision; if so, add it as a semantic slot in
   `palette.ts`, not as a literal at the call site.
6. **Accessibility is part of done**: never colour alone; an icon button needs
   `ariaLabel` (use `TooltipIconButton`); interactive elements need a visible
   focus state — the theme's `:focus-visible` ring covers this if you do not
   override `outline`.
7. **Do not re-specify theme defaults at the call site.** `<Button>` is already
   outlined, 36px, non-uppercase; `<Paper>` already has elevation 1 and a
   divider border; `<Table>` is already `size="small"`. Restating them is drift.

### Do not

- Add Tailwind, CSS modules, styled-components, or a second styling system.
- Add a global stylesheet. `CssBaseline` emits the global layer from theme
  values; that is the only source.
- Add a second `declare module "@mui/material/styles"` block — merge into
  `src/theme/module-augmentation.ts` (two blocks for one interface = `TS2717`).
- Change `spacing`, `shape.borderRadius` or `shadows` in `theme/index.ts`
  without re-checking every screen; every component assumes the current values.
- Upgrade or downgrade the MUI major without a deliberate migration pass.
