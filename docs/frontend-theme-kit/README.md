# RiskPoint frontend theme kit

**Read this file top to bottom before writing code.** It is written for an
agent adopting this design system into a React app. §1 is the procedure, §2 is
the mental model you need in order to write *new* components that fit, §3–§5 are
reference.

The last step of §1 is to paste **`CLAUDE-section.md`** into the target repo's
`CLAUDE.md`. Do not skip it: it is what keeps the next session inside the system
once this README is out of context.

What this kit is: a complete MUI v6 design system — theme tokens plus 30
domain-free components built on them. Copied from `frontend/src/` of the
RiskPointPOC_app repo on 18/09/2026, where it has zero colour literals outside
the theme across 176 source files.

It typechecks standalone under `strict` against MUI v6 + React 18.3 + TS 5.4
with only `node_modules` on the path — verified, not assumed.

---

## 1. Procedure

Do these in order. Each step has a check; do not proceed past a failing check.

### Step 1 — install dependencies

```bash
npm i @mui/material @mui/system @mui/icons-material @emotion/react @emotion/styled
npm i react-router-dom     # required: AccentLink and DetailHeader import it
```

Target versions: MUI **v6**, Emotion 11, React 18.3, TypeScript 5.4.

If the app already has MUI at a different major, stop and resolve that first —
see §6. Two MUI majors in one app is not viable.

### Step 2 — copy the files

| From this kit | To the app |
|---|---|
| `theme/` (7 files) | `src/theme/` |
| `components/primitives/` | `src/components/primitives/` |
| `components/layout/` | `src/components/layout/` |
| `components/containers/` | `src/components/containers/` |
| `components/data-display/` | `src/components/data-display/` |
| `lib/statusStyles.ts` | `src/lib/statusStyles.ts` |

Copy them verbatim. Do not "improve" them on the way in — in particular do not
reformat `theme/components.ts`, which is where most of the visual identity lives.

### Step 3 — configure the `@/` path alias

The components import each other as `@/components/primitives` and
`@/lib/statusStyles`. Both must resolve, in the bundler *and* in TypeScript:

```ts
// vite.config.ts
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

```jsonc
// tsconfig.json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```

**Check:** `npx tsc --noEmit` reports no `TS2307: Cannot find module '@/...'`.

### Step 4 — load the fonts

The theme names Montserrat and JetBrains Mono. Without them every fallback
renders and the app looks wrong in a way that is easy to misdiagnose as a
broken theme. Add to `index.html` (self-host before production):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
```

### Step 5 — mount the provider

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
```

Three ordering rules, all of which produce confusing symptoms when broken:

1. **`ThemeProvider` must wrap everything** that renders a themed component.
   Outside it, MUI silently falls back to its *default* theme — the app renders
   without errors, just wrong (white background, blue buttons, Roboto).
2. **`CssBaseline` must be inside `ThemeProvider`**, as a sibling of your app.
   It reads the theme via context; outside it, it emits the default baseline.
3. `ThemeProvider` goes **outside** your router and data-layer providers, not
   inside. It has no dependency on them and they may render themed UI.

### Step 6 — smoke test

Render this somewhere and look at it:

```tsx
import { PageHeader, Section } from "@/components/layout";
import { StatTile, MetricValue, StatusBadge } from "@/components/primitives";

<>
  <PageHeader title="Jobs" subtitle="Everything currently running" />
  <Section title="Summary">
    <StatTile label="Completed" value="128" />
    <MetricValue value="1,204" unit="ms" />
    <StatusBadge kind="job" state="running" />
  </Section>
</>
```

Expected: a putty `#eceee5` page background, a white card with an 8px radius and
a hairline `#e2e8f0` border, Montserrat throughout, and a blue-tinted "◐ Running"
pill.

| Symptom | Cause |
|---|---|
| White background, blue buttons, Roboto | `ThemeProvider` missing or the tree renders outside it |
| Correct colours but no page background | `CssBaseline` missing, or placed outside `ThemeProvider` |
| Correct layout, wrong font | Step 4 skipped |
| Everything cramped or doubled in spacing | the app overrode `spacing` — see §2.4 |
| Badge has no screen-reader text | `CssBaseline` missing: it emits the `.sr-only` class |

### Step 7 — adapt the domain layer

`lib/statusStyles.ts` ships as a **stub** built around a fictional `job` entity.
It is the one file you are expected to rewrite. Replace `Kind`, `StateValue` and
the style map with your app's entities, keeping the shape:

```ts
export const ORDER_STYLES: Record<OrderState, StatusStyle> = {
  pending:   { tone: "neutral", icon: "•", label: "Pending" },
  shipped:   { tone: "ok",      icon: "✓", label: "Shipped" },
  cancelled: { tone: "err",     icon: "✕", label: "Cancelled" },
};
```

Two constraints, both deliberate:

- **`Record<State, Style>`, never a partial map plus a fallback.** A new state
  then becomes a compile error instead of a blank badge.
- **Every entry carries colour *and* icon *and* label.** Never colour alone —
  the badge has to survive a greyscale screenshot and a colour-blind reader.

`StatusBadge` and everything below it adapt automatically.

### Step 8 — delete what you don't need

Nothing cross-imports except `Badge → useStatusTone` and `StatusBadge → Badge`,
so any other component can be deleted without breakage. Remove it from the
category's `index.ts` barrel when you do.

### Step 9 — add the lint rule

See §2.6. This is the one convention that does not enforce itself.

### Step 10 — write the rules into the new repo's `CLAUDE.md`

Steps 1–9 install the system. This step is what keeps a future session inside
it. Copy the block in **`CLAUDE-section.md`** into the target repo's
`CLAUDE.md` (create the file if it does not exist), adjusting the paths in its
first block if your source tree differs.

It states four rules — compose before you create, no colour literals, one door
for status colour, `sx` numbers are multiplied — plus the checklist for when a
new component genuinely is needed, and a "do not" list (no second styling
system, no global stylesheet, no second `declare module` block).

Without it, the next agent to touch this repo will not know any of this and will
write a `styled.div` with a hex colour in it. The system decays from the first
page that ignores it.

---

## 2. The model you need in order to write new components

Steps 1–9 install the system. This section is how you *stay* inside it when
writing code that was never in this kit. Treat §2.5 and §2.6 as hard rules.

### 2.1 What `ThemeProvider` actually is

`ThemeProvider` is a **React context provider**. `theme` (from `theme/index.ts`)
is a plain object; the provider puts it on the context; every MUI component and
every `sx` prop below it reads from that context.

Consequences worth internalising:

- Tokens are available **anywhere in the tree** without prop-drilling. Never
  pass colours or spacing down as props.
- Nesting a second `ThemeProvider` **scopes** a theme change to that subtree.
  To adjust rather than replace, use the callback form, which receives the
  outer theme:
  ```tsx
  <ThemeProvider theme={(outer) => createTheme(outer, { palette: { … } })}>
  ```
- There is **no global CSS to import**. The kit ships no stylesheet. Anything
  that looks like global CSS (the body background, the focus ring, `.sr-only`,
  the `rp-pulse` keyframe, the `--rp-*` custom properties) is emitted by
  `CssBaseline` from theme values — which is why step 5.2 matters.

### 2.2 The four ways to read a token — and which to use

**(a) `sx` with a string path — the default.** Terse, and covers most needs.
MUI resolves known keys against the palette and the spacing scale.

```tsx
<Box sx={{ color: "text.secondary", bgcolor: "surface.muted", p: 2, borderRadius: 1 }} />
```

**(b) `sx` with a callback — when you need a token MUI won't resolve for you**,
such as a colour inside a composite value (a border shorthand, a shadow):

```tsx
<Box sx={(theme) => ({
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[1],
})} />
```

**(c) `useTheme()` — when the value feeds logic, not style**: a chart library's
config, a canvas fill, a conditional.

```tsx
const theme = useTheme();
<Chart colors={[theme.palette.brand.main, theme.palette.accent.main]} />
```

**(d) `styled()` — for a reusable element with a fixed identity.** The kit
barely uses it; prefer `sx` unless you are creating a genuinely new primitive.

Order of preference: (a) → (b) → (c) → (d). Reach for the simplest that works.

### 2.3 `sx` numeric units — the trap

Inside `sx`, numbers are **multiplied** by a scale, and the scale differs by
property:

| `sx` prop | Multiplier | `1` means |
|---|---|---|
| `p`, `m`, `gap`, `px`, `mt`, … | `spacing` = **4** | 4px |
| `borderRadius` | `shape.borderRadius` = **8** | 8px |
| `width`, `height`, `fontSize`, … | none | `1px` |

So `borderRadius: 8` in `sx` is **64px**, not 8px. Use `borderRadius: 1`. And
because this theme's spacing base is 4 rather than MUI's default 8, every
spacing number in the shipped components assumes 4 — if you change
`spacing` in `theme/index.ts`, every component in this kit re-spaces.

The same numbers inside `theme/components.ts` `styleOverrides` are **raw CSS**
with no multiplier. `borderRadius: 8` there really is 8px. Two different
dialects in two files; check which one you are editing.

### 2.4 Which token to reach for

Address the **semantic slot**, not the ramp shade behind it. The slots exist so
that a palette change is one edit.

| You want | Use | Not |
|---|---|---|
| a hairline, border, divider | `divider` | `paper.rule`, `#e2e8f0` |
| an emphasised / control border | `border.strong` | `paper.ruleStrong` |
| muted or secondary text | `text.secondary` | `brand[400]` |
| a card surface | `background.paper` or `surface.raised` | `#ffffff` |
| a recessed panel / table header | `surface.muted` | `paper.muted` |
| primary ink, fills, active nav | `brand.main` | `#122933` |
| a status colour | `useStatusTone(tone)` | `palette.status.*`, `error.main` |

Full token tables in §3.

### 2.5 Hard rule: no colour literals outside `theme/`

No `#rrggbb`, no `rgb()`, no `rgba()`, no named CSS colours in any component.
Zero, today, across 176 files in the source app. This is the single rule that
separates "themed" from "themed for now" — a literal works, looks right, and
then silently fails to follow the next palette change.

For transparency use MUI's helper, never string concatenation:

```tsx
import { alpha } from "@mui/material/styles";
alpha(theme.palette.brand.main, 0.12)   // correct
`${theme.palette.brand.main}1f`          // wrong — breaks on rgb()/named values
```

The one sanctioned exception is a deliberately document-first stylesheet — e.g.
a print export that must *not* follow the app palette. Confine it to one file
and say so in a comment at the top.

### 2.6 Hard rule: status colour has exactly one door

`theme.palette.status.*` is read **only** by `useStatusTone`. Everything that
needs a status colour — badges, table cell text, progress bars, threshold
colouring — calls the hook:

```tsx
const { color, bg, border } = useStatusTone("warn");
const all = useStatusTones();   // when you colour by more than one tone
```

This does not enforce itself. Add to `.eslintrc.cjs`:

```js
"no-restricted-syntax": ["error", {
  selector: "MemberExpression[property.name='status'][object.property.name='palette']",
  message: "Read status colours through useStatusTone / the status primitives.",
}],
```

with an `overrides` entry turning it off for
`src/components/primitives/useStatusTone.ts`, `src/theme/**`, and test files.

### 2.7 Where to put a new component

Categories are organised by **what a component knows**, and the dependency runs
one way only:

```
primitives/    MUI only. No domain types, no data fetching. Atoms.
layout/        Page scaffolding. Composes primitives.
containers/    Stateful in-page chrome (open/closed). Composes the two above.
data-display/  Read-only renderers. Compose primitives. No fetching.
inputs/        Form fields, pickers, drop zones.
domain/        Knows your entities. The only category that imports your types.
feedback/      Async / empty / error panels.
printable/     Print-only trees.
```

Rules that keep this from becoming a component museum:

- A component may import from its own category and from any category **above**
  it in that list. Never downward, never sideways into `domain/`.
- Every category has an `index.ts` barrel. Import
  `@/components/primitives`, never `@/components/primitives/Badge`.
- A new shared container needs **≥2 real call sites**. One caller is not a
  component, it is a section of that page.
- Before writing a component, check §4 — 30 already exist.

---

## 3. Token reference

### Palette

| Slot | Value | Use |
|---|---|---|
| `brand.main` | `#122933` | deep navy-teal ink — fills, active nav, primary buttons |
| `brand.dark` / `brand[700]` | `#1c3a49` / `#0b1b22` | hover / deepest ink |
| `brand[50..500]` | `#f8fafc` → `#334155` | slate ladder |
| `paper.main` | `#eceee5` | app background (putty) |
| `paper.muted` | `#f1f5f9` | recessed tint |
| `paper.rule` / `paper.ruleStrong` | `#e2e8f0` / `#cbd5e1` | hairline / emphasised rules |
| `accent.main` | `#a1a67c` | sage — header strip, accent rules, links |
| `accent[50..600]` | `#f5f6ef` → `#4d5039` | sage ramp |
| `status.ok/warn/err/info/neutral` | `#16a34a` `#d97706` `#dc2626` `#1c3a49` `#64748b` | **via `useStatusTone` only** (§2.6) |
| `background.default` / `.paper` | `#eceee5` / `#ffffff` | ground / cards |
| `text.primary/secondary/disabled` | `#0f172a` / `#64748b` / `#94a3b8` | ink / muted / disabled |
| `divider` | `#e2e8f0` | every hairline |
| `border.strong` | `#cbd5e1` | control + emphasised borders |
| `surface.raised` / `.muted` | `#ffffff` / `#f8fafc` | card / table-header fill |

Light mode only — there is no dark palette. If you need one, add it before
building screens: retrofitting means auditing the `common.white` literals in
`theme/components.ts`.

### Typography

Montserrat (400/500/600/700) for everything; JetBrains Mono (tabular figures)
for numeric and code readouts. **No serif face** — deliberate.

| Variant | Size / weight | Use |
|---|---|---|
| `displayXl` / `h1` | 40px / 600 / `-0.025em` | page title |
| `displayLg` / `h2` | 32px / 600 | section title |
| `displayMd` / `h3` | 24px / 600 | card title |
| `body1` | 14px | default body |
| `body2` | 13px | dense body |
| `tableCell` | 14px / 400 | data rows |
| `labelSm` | 12px / 400 | labels, captions |
| `eyebrow` | 12px / 500, **normal case** | stat-card + section labels |
| `mono` | 13px JetBrains Mono | ids, figures, quotes |
| `button` | 600, `textTransform: none` | — |

`eyebrow` is a trap: the name is historical. This design uses **no all-caps
anywhere**, so it is a plain 12px label tier, not a small-caps eyebrow.

Custom variants are usable as `<Typography variant="displayXl">` because
`theme/module-augmentation.ts` declares them. That file must be imported before
`createTheme` — `theme/index.ts` already does it. If your app also augments the
MUI theme, **merge** the declarations into one file; two `declare module` blocks
for the same interface produce `TS2717`.

### Shape and shadow

- `shape.borderRadius: 8`. Pills use the literal `999`. Dialogs use the
  `dialogRadius` knob in `theme/shape.ts`.
- Shadows are a deliberate 3-step ramp: `1` = `shadow-sm` (cards), `2` =
  `shadow-lg` (popovers, dialogs), `3..24` all = `shadow-2xl` (drawers and
  slide-overs only). Heavy shadow is reserved for overlay chrome.

### Defaults baked into `theme/components.ts`

A lot of the visual identity is here rather than in the components — which is
why you copy the file whole:

Buttons default to `variant="outlined"`, `disableElevation`, 36px min height, no
uppercase. Papers default to `elevation={1}` with a 1px divider border and
`backgroundImage: none`. Tables default to `size="small"` with a `surface.muted`
head and 12/16px cells. TextFields default to `outlined` + `small`. **Tabs
render as segmented pills** — the MUI underline indicator is hidden; active is
an ink fill with white text. Tooltips are white-on-ink at 12px.

So `<Button>Save</Button>` is already correct. Do not re-specify these defaults
at call sites.

---

## 4. Component catalogue

All of these are domain-free and drop-in. Check here before writing anything.

### Primitives — `@/components/primitives`

| Component | Props |
|---|---|
| `Badge` | `tone, icon, label, variant?: "filled" \| "tinted", srLabel?` |
| `StatusBadge` | `kind, state` — the domain adapter; rewrite `lib/statusStyles.ts`, keep this |
| `StatusText` | `variant, children, size?, component?, role?, title?, sx?` |
| `useStatusTone(tone)` / `useStatusTones()` | → `{ color, bg, border }` — the only sanctioned `palette.status` reader |
| `Eyebrow` | `children, component?, color?, htmlFor?, sx?` |
| `Rule` | `variant?: "plain" \| "accent"` |
| `LiveDot` | `size?, label?` |
| `Pill` | `tone?, children, size?: "xs" \| "sm", title?` — non-status chip |
| `MetricValue` | `value, unit?, emphasis?, size?` |
| `StatTile` | `label, value, size?, accent?, sub?, sx?` |
| `MicroText` | `children, size?, dim?, component?, sx?` |
| `HelperText` | `children, italic?, inline?, role?, sx?` |
| `AccentLink` | `to, children, onClick?, sx?` |
| `RailNode` | `label, onClick, selected?, leading?, trailing?, subLabel?, variant?, ariaCurrent?` |
| `CopyButton` | `value, ariaLabel?, size?` |
| `TooltipIconButton` | `title, icon, ariaLabel, tooltipPlacement?` + IconButton props |
| `ErrorMarker` | `label?, onClick?` |

### Layout — `@/components/layout`

| Component | Props |
|---|---|
| `PageHeader` | `title, subtitle?, actions?, meta?` |
| `Toolbar` | `children, sticky?, variant?: "page" \| "section"` |
| `Section` | `title?, actions?, children, dense?, variant?: "paper" \| "muted"` |
| `DetailHeader` | `breadcrumb: string[], actions?, onBack?, backLabel?` |
| `OptionsBlock` | `title, children, collapsible?, defaultOpen?` |
| `RailFrame` | `header, filter?, footer?, children, bodyPadding?` |
| `ThreePaneLayout` | `primary, secondary?, detail, showSecondary?, primaryWidth?, secondaryWidth?` |
| `AsyncBoundary` | loading / error / empty wrapper |
| `chrome.ts` | `CHROME_H`, `FOOTER_H`, `FILL_HEIGHT` — see §6.4 |

### Containers and data-display

| Component | Props |
|---|---|
| `CollapsibleCard` | `title, rightSlot?, defaultOpen?, children` |
| `KeyValueGrid` | `entries: Record<string, string \| null>, sx?` |
| `DataTable<R>` | `rows, columns, getRowId, onRowClick?, loading?, fetching?, skeletonRows?, emptyMessage?, searchable?, searchPlaceholder?, initialSort?, pagination?` |

Read `DataTable` before writing any table. It distinguishes **`loading`** (first
load → skeleton rows, sized to the page size so the card lands at its final
height) from **`fetching`** (refetch with rows already on screen → progress bar,
rows stay visible). That distinction is most of what makes a table feel calm
instead of flickering.

### Deliberately not shipped

The source app's `AppShell` (header band, sage strip, nav, fixed footer), its
print tree, and everything under `domain/` and `inputs/` that names RiskPoint
entities. Build your own shell — §6.4 is the one thing to copy from ours.

---

## 5. If the target app already has MUI

**v6 already** — proceed with §1 as written.

**A different major** — resolve that first. v5 has `Grid` v2 behind
`Unstable_Grid2` and differs in some `styleOverrides` signatures; v7 renames
slots and moves packages. The kit's components use `Box`/`Stack` rather than
`Grid`, so the exposure is small, but compile against the app's version before
assuming it is clean.

**An established theme already exists** — merge tokens rather than replacing:

1. Copy `palette.ts`, `typography.ts`, `shape.ts`, `shadows.ts` and
   `module-augmentation.ts`; hold `components.ts` back.
2. Spread the new slots into the existing palette so their `primary`/`secondary`
   survive:
   ```ts
   palette: { ...theirPalette, brand, paper, accent, status,
              border: { strong: paper.ruleStrong },
              surface: { raised: "#ffffff", muted: "#f8fafc" } }
   ```
3. Introduce `components.ts` overrides **one block at a time**, checking their
   screens after each. `MuiTab` is the most disruptive — it turns every tabbed
   screen into segmented pills. `MuiButton`, `MuiPaper`, `MuiTableCell` and
   `MuiOutlinedInput` are next.
4. To use the kit's components *without* re-skinning the host app, nest a scoped
   provider (§2.1).

Collisions to expect: spacing base (4 vs their likely 8), a duplicate
`declare module` block (`TS2717`), typography variant names (`eyebrow`, `mono`,
`labelSm`, `tableCell`, `display*`), and `shadows` — the kit replaces the whole
25-entry array, flattening their elevations 3–24.

---

## 6. Traps

1. **Spacing base is 4, not MUI's 8.** First thing to check if everything looks
   cramped or loose. §2.3.
2. **`borderRadius` multiplies in `sx` but not in `styleOverrides`.** §2.3.
3. **`CssBaseline` is load-bearing**, not cosmetic: it emits the `--rp-*`
   variables, `.sr-only` (every badge's screen-reader text), the focus ring and
   the `rp-pulse` keyframe. It must sit inside `ThemeProvider`.
4. **Don't hardcode `calc(100vh - 240px)`.** A shell should publish its measured
   chrome height as a CSS variable (`--rp-chrome-h`) and viewport-filling pages
   should read it via `sx={FILL_HEIGHT}`, resolved at paint time. In the source
   app the hardcoded guess was wrong by ~65px and showed as dead space under
   every table. `chrome.ts` ships so you can copy the technique.
5. **`theme/components.ts` carries one deliberate literal** — `#475569` as the
   outlined-button text, which has no semantic slot. If that matters, add e.g.
   `text.control` to the palette and point it there rather than leaving the
   literal to be copied.
6. **Bundle cost**: MUI + Emotion is ~780KB JS in the source app (CSS is 6.7KB
   total). Know that you are making that trade.

---

## 7. File manifest

```
theme/                       copy verbatim — the whole design system
  palette.ts                 colours, incl. the semantic slots
  typography.ts              families + all 10 variants
  shape.ts                   borderRadius base + dialogRadius
  shadows.ts                 the 3-step ramp
  components.ts              MUI component defaults — most of the "look"
  module-augmentation.ts     TS declarations; import before createTheme
  index.ts                   createTheme(...) — spacing: 4 lives here
components/primitives/       17 files + barrel — MUI-only atoms
components/layout/           8 containers + chrome.ts + barrel
components/containers/       CollapsibleCard + barrel
components/data-display/     DataTable, KeyValueGrid
lib/statusStyles.ts          domain adapter — REWRITE this (step 7)

CLAUDE-section.md            paste into the new repo's CLAUDE.md (step 10)
README.md                    this file — the handbook
```
