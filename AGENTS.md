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
