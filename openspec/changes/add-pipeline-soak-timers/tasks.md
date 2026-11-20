## 1. Soak duration parsing

- [ ] 1.1 Add `soakOf(actionYmlPath)` to `src/server/strategy.ts`, reading the `soak:` input's compiled `default:` value out of `.github/actions/promote-change/action.yml` by regex (the same convention `readStageBranches` already uses for a shell constant), and parsing its `stage=duration` pairs (`main=5m,test=5m`) into a `Record<string, number>` of seconds, keyed by the stage the change is soaking *into*. `undefined` when the input or its default is missing, or any pair/duration fails to parse (same convention as `readStageBranches`).

## 2. Remaining-soak arithmetic

- [ ] 2.1 Add a pure `remainingSoakSeconds(soakSeconds, mergedAt, now)` function (`src/server/stages.ts`) computing `max(0, floor(soakSeconds - (now - mergedAt) / 1000))`, so an already-elapsed soak floors to zero rather than going negative.

## 3. Per-stage soak and items in `/api/stages`

- [ ] 3.1 Extend `Stage` in `src/shared/types.ts` with `items: readonly { issue: number; url: string }[]` (every issue currently merged onto this stage and not yet promoted past it, whether or not it is blocking) and an optional `soak?: { remainingSeconds: number; completesAt: string }`.
- [ ] 3.2 In `listStages` (`src/server/stages.ts`), reuse the existing `commitsAhead`/`alreadyPromoted`/`issueOfCommit` plumbing to populate `items` for every stage (not only frozen ones), and compute `soak` for the eligible (not already-promoted, not frozen) case from the newest ahead commit's merged-at timestamp (read via `/commits/{sha}/pulls`) and the matching entry of `soakOf(...)`. Leave `soak` unset when the stage is frozen, when nothing is eligible, or when the soak default could not be read -- the pipeline degrades to showing stages with no timers rather than crashing.
- [ ] 3.3 Wire `soakOf` into `src/server/main.ts` next to the existing `strategy`/`stageBranches` reads (same try/catch-to-undefined shape) and pass it into `listStages`.

## 4. Horizontal pipeline graphic

- [ ] 4.1 Replace the vertical `<ol>` stage list in `src/web/App.tsx` with a horizontal row of stage nodes (dev → test → main), each showing its name, its `items` (issue links), a frozen badge with `blockedBy` when frozen, and -- when present and not frozen -- a live countdown built from `soak.remainingSeconds`/`completesAt` (remaining duration and the wall-clock completion time), ticking client-side between polls using the existing 30s stage-fetch interval in `App.tsx` as the resync point.
- [ ] 4.2 A stage with no items shows an empty node with no timer; a frozen stage never shows a countdown even if `soak` happens to be present.

## 5. Tests

- [ ] 5.1 `src/server/strategy.test.ts`: `soakOf` against this repository's real `promote-change/action.yml` (expects `{ main: 300, test: 300 }`), and against a malformed/missing fixture (`undefined`).
- [ ] 5.2 `src/server/stages.test.ts`: `remainingSoakSeconds` against fixed `mergedAt`/`now` pairs, including one where the soak has already elapsed (negative delta floors to zero).
