## 1. GitHub App authentication

- [ ] 1.1 Add `src/server/github-app.ts` exporting `authHeaders(owner: string): Promise<Record<string,string>>`. When `GH_APP_ID` and `GH_APP_PRIVATE_KEY` are both set: sign a JWT (RS256, `iat`/`exp`/`iss` claims) with `node:crypto` (no new dependency), normalising a private key that arrives with literal `\n` sequences; exchange it via `POST /app/installations/{installation_id}/access_tokens` (resolving the installation id for `owner` via `GET /repos/{owner}/{repo}` -> `GET /app/installations` or `GET /orgs/{owner}/installation` / `GET /users/{owner}/installation` as appropriate) using the JWT as bearer auth; cache the resulting installation token per owner in memory until shortly (60s) before its `expires_at`, refreshing the JWT itself (10 minute lifetime) as needed. When no App is configured, fall back to `process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? ""`. Log once (not per-poll) which identity is in use ("GitHub App" vs "personal access token" vs "unauthenticated").
- [ ] 1.2 Replace the three duplicated `token`/`headers()` blocks in `src/server/runs.ts:17`, `src/server/metrics.ts:18-26`, `src/server/stages.ts:16,40-50` with calls through the new shared forge client (task 2.1), which internally calls `authHeaders`.

## 2. Shared forge client: rate limiting and conditional requests

- [ ] 2.1 Add `src/server/forge.ts` exporting a `forgeGet<T>(path: string, owner: string): Promise<{ status: number; body: T | undefined }>` (or similar) that all GitHub REST calls go through, replacing the raw `fetch` calls at `src/server/runs.ts:73,86`, `src/server/metrics.ts:81,91,99,109,122,149`, `src/server/stages.ts:41`. It must: merge in `authHeaders(owner)` from task 1.1; attach `If-None-Match` from an in-memory ETag store keyed by request URL when present; on a `304`, return the cached body without re-parsing a new one and without treating it as consuming the rate-limit budget; on any response, read `x-ratelimit-remaining`/`x-ratelimit-limit`/`x-ratelimit-reset` headers and update the shared rate-limit state (task 2.2); store the response's `etag` header (on `200`) in the ETag store; before issuing a request, consult the rate-limit state and skip the call (returning a sentinel the caller treats as "no data this tick") when paused.
- [ ] 2.2 Add `src/server/rate-limit.ts` holding in-memory rate-limit state (`remaining`, `limit`, `resetAt`, `pausedUntil`) with `recordHeaders(headers: Headers)`, `recordRateLimitError(headers: Headers)` (for a `403`/`429` whose body or headers indicate a rate-limit, e.g. `x-ratelimit-remaining: 0` or a message containing "rate limit"), and `isPaused(now: Date): boolean`. Pause when remaining/limit drops below 10%, clearing automatically once `now >= resetAt`. A `403`/`429` rate-limit response sets `pausedUntil` from `x-ratelimit-reset` (or a short default back-off if the header is absent) instead of being retried.
- [ ] 2.3 In `src/server/main.ts`, before each `poll()` tick (`main.ts:125-137`) and before `metricsCache.refresh()` (the more expensive of the two loops per the exploration brief), check `isPaused()` and skip the fetch cycle entirely when paused, logging the pause once per pause period rather than every tick.
- [ ] 2.4 Add a small `/api/rate-limit` branch to the request handler in `src/server/main.ts` (alongside the existing `/api/runs`, `/api/strategy`, `/api/stages`, `/api/health` branches) returning `{ pausedUntil: string | null }` from the shared rate-limit state, never triggering a live forge fetch.

## 3. Run log cache (fetch each completed run's log at most once)

- [ ] 3.1 In `src/server/metrics.ts`, add an in-memory `Map<number, string | undefined>` cache of run id -> parsed outcome line, module-scoped alongside `MetricsCache`. In `runsWithOutcome()` (`metrics.ts:129-141`), consult the cache before calling `outcomeLineOf`/`firstJobId`; populate the cache after a successful fetch; only ever fetch for a run missing from the cache, and never re-fetch a run whose `status === "completed"` once it has an entry (a non-completed run may be refetched on a later tick until it completes).

## 4. Default poll interval

- [ ] 4.1 Change `src/server/main.ts:32` so `POLL_SECONDS` defaults to `300` instead of `20`.

## 5. "Data paused" banner

- [ ] 5.1 Add a `RateLimitBanner` component under `src/components/feedback/` (new category; follow `AGENTS.md` design-system rules: semantic tokens only, `useStatusTone` for colour) that polls `/api/rate-limit` every 30s (mirroring the interval pattern in `src/web/pages/Log.tsx:43-56`) and renders a quiet "data paused until HH:MM" message when `pausedUntil` is set and in the future, otherwise renders nothing.
- [ ] 5.2 Mount `RateLimitBanner` in the `TopBar` in `src/web/pages/Shell.tsx` (`Shell.tsx:76-104`), alongside the existing repo label and `PeriodSelector`.

## 6. Tests

- [ ] 6.1 `src/server/github-app.test.ts`: generate an RSA keypair with `node:crypto` at test time, sign a JWT with it, verify its claims/signature; mock the installation-token exchange endpoint (via an injected fetch) and assert the resulting token is cached and reused until shortly before `expires_at`, then refreshed after expiry; assert the `GH_TOKEN` fallback path when no App env vars are set.
- [ ] 6.2 `src/server/rate-limit.test.ts`: `recordHeaders` with a low `x-ratelimit-remaining` triggers `isPaused() === true` until `resetAt`; `recordRateLimitError` on a `403` sets a `pausedUntil` without retrying.
- [ ] 6.3 `src/server/forge.test.ts`: a stored ETag is sent as `If-None-Match` on the next request to the same URL; a `304` response reuses the cached body and does not overwrite the ETag store with an empty value.
- [ ] 6.4 `src/server/metrics.test.ts`: extend with a case asserting a completed run's log is fetched at most once across two `runsWithOutcome` calls for the same run id.
