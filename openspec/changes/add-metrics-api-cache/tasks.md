## 1. Multi-repository configuration

- [ ] 1.1 Add a shared `repos()` helper (e.g. in `src/server/repos.ts`) that reads `process.env["LOOP_REPOS"]` as a comma-separated list, trims each entry, drops blanks, deduplicates, and falls back to `["PersonalCorpAcc/agentic-loop-canary"]` when unset -- the same fallback `LOOP_REPO` uses today.
- [ ] 1.2 Replace the single `LOOP_REPO` read in `src/server/runs.ts:15` and `src/server/stages.ts:14` so both modules can operate against a given repository rather than a module-level constant, without changing their existing exported behaviour for a single repository.

## 2. Cached per-repository snapshot

- [ ] 2.1 Create `src/server/metrics.ts` holding one cached snapshot per configured repository: issues, pull requests, labels, workflow runs, and each run's outcome line parsed with `outcomeOf` from `src/shared/outcome-line.ts` (fetching each run's job log to get the text `outcomeOf` parses).
- [ ] 2.2 On a refresh interval (an env-configured constant following the `POLL_SECONDS` pattern in `src/server/main.ts`), refetch every configured repository's snapshot and replace its cache entry, oldest-first.
- [ ] 2.3 A repository whose fetch fails (token cannot read it, forge error) is marked failed in its own cache entry without discarding or blocking the other configured repositories' cached data, mirroring the `.catch(() => [])` shape already used for `/api/runs` in `main.ts`.
- [ ] 2.4 A request arriving while a refresh is in flight is served the previous snapshot rather than waiting on the fetch in progress.

## 3. `/api/metrics` endpoint

- [ ] 3.1 Add a `/api/metrics?repo=<owner/name>` branch to the request handler in `src/server/main.ts` (alongside `/api/runs`, `/api/strategy`, `/api/stages`, `/api/health`) that reads the named repository's cached snapshot from `metrics.ts` and returns it as JSON with a `refreshedAt` timestamp, never triggering a live forge fetch.
- [ ] 3.2 Confirm `GH_TOKEN` stays server-side only and no `/api/*` response body or header carries its value (it already does not for the existing endpoints; keep the same shape for the new one).

## 4. Tests

- [ ] 4.1 In a new `src/server/repos.test.ts` (or alongside the relocated helper): `LOOP_REPOS` parsing -- comma-split, trimmed, deduplicated, blanks dropped, falls back to the single default when unset.
- [ ] 4.2 In a new `src/server/metrics.test.ts`, following the pattern in `src/server/runs.test.ts` and `src/server/stages.test.ts`: a scheduled refresh replaces a repository's cached snapshot, and one repository's failed fetch leaves every other repository's cache untouched.
