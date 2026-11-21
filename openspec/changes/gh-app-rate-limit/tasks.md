# Tasks: Authenticate as a GitHub App and respect GitHub's rate limit

Refs #207. Pre-refined issue — acceptance criteria in the issue body are the source of
truth. Second attempt: the first (#213) added this exact shape (`github-app.ts`,
`rate-limit.ts`, `forge.ts`) but its pull request never merged, so none of it exists on
`dev` yet; this reimplements it from scratch rather than resuming a branch that is gone.

Scope decisions:

- One shared authenticated-fetch client (`src/server/forge.ts`, a `ForgeClient` class,
  constructor-injected fetch/now/logger like `MetricsCache` already is in
  `src/server/metrics.ts`) replaces the token-header boilerplate duplicated across
  `runs.ts`, `stages.ts` and `metrics.ts`. It owns rate-limit tracking, the pause-until-
  reset gate, ETag reuse, and 403/429 back-off in one place, so every caller gets all
  four behaviours for free instead of three copies drifting apart.
- GitHub App JWT signing uses `node:crypto`'s `createSign`/`createVerify` (RS256) directly
  — no new dependency, no lockfile change.
- Installation tokens are cached per repository owner and refreshed a few minutes before
  `expires_at`, the same "cache until shortly before it expires" the issue asks for.
- Identity (`GitHub App <id>`, `GH_TOKEN`, or `unauthenticated`) is logged once per process,
  not once per request.
- The "paused until HH:MM" banner reads a new `/api/rate-limit` endpoint, polled from the
  existing top bar in `src/web/Shell.tsx` — no websocket event added, matching how `/api/repo`
  is already a plain poll-once-on-mount fetch there.

- [ ] 1. `src/server/github-app.ts`: `signAppJwt(appId, privateKeyPem, now)` (RS256 JWT,
      `iss`/`iat`/`exp`), `appCredentialsOf(env)` (reads `GH_APP_ID` /
      `GH_APP_PRIVATE_KEY`, unescapes literal `\n`), and `installationTokenFor(repo,
      credentials, fetchImpl, now)` — looks up the repo's installation id, exchanges the
      JWT for an installation access token, and caches it per owner until shortly before
      `expires_at`.
- [ ] 2. `src/server/forge.ts`: `ForgeClient` with `fetchJson<T>(url, repo)` and
      `fetchText(url, repo)`. Resolves a token via an injected `tokenFor(repo)` (GitHub
      App first, `GH_TOKEN`/`GITHUB_TOKEN` fallback, logged once), tracks
      `X-RateLimit-Remaining`/`X-RateLimit-Limit`/`X-RateLimit-Reset` from every response,
      stops issuing requests (returns `undefined` without calling `fetch`) once remaining
      drops below 10% of limit until the reset time passes, sends `If-None-Match` from a
      per-URL ETag cache and reuses the cached body on `304`, and on `403`/`429` whose
      body or headers say rate-limited sets the pause instead of retrying. Export a
      default `forge` instance wired to real `fetch`/`Date.now`/`console` and
      `installationTokenFor`, plus `forge.status()` for the `/api/rate-limit` endpoint.
- [ ] 3. Refactor `src/server/runs.ts`, `src/server/stages.ts` and `src/server/metrics.ts`
      to route every GitHub request through the shared `forge` client instead of their own
      `fetch` + bearer-token header code. Keep every exported pure function's behaviour
      (`routeOf`, `subjectOf`, `carriedIssuesOf`, `blockingLabelOf`,
      `remainingSoakSeconds`, etc.) unchanged.
- [ ] 4. `src/server/metrics.ts`: cache a completed run's outcome line (including a
      lookup that found nothing) so `runsWithOutcome` never re-fetches its job log on a
      later refresh; a run that has not finished yet is always re-fetched.
- [ ] 5. `src/server/main.ts`: default `POLL_SECONDS` to `300`; add `GET /api/rate-limit`
      returning `forge.status()`.
- [ ] 6. `src/web/Shell.tsx`: a quiet "data paused until HH:MM" banner in the top bar,
      polling `/api/rate-limit` and rendering only while paused.
- [ ] 7. Tests: `src/server/github-app.test.ts` (JWT signing + verification with a
      generated RSA key pair, installation-token exchange and its caching),
      `src/server/forge.test.ts` (403/429 back-off stops further requests until reset,
      ETag reuse on a `304`, the 10%-remaining pause), and a `src/server/metrics.test.ts`
      addition proving a completed run's log is fetched at most once across two
      `runsWithOutcome` calls.
