import { appCredentialsOf, installationTokenFor } from "./github-app.js";

/**
 * The one client every server module talks to the forge through.
 *
 * Centralising this is what let #207's four requirements -- GitHub App auth, respecting the
 * rate limit, conditional requests, and backing off rather than retrying -- live in one place
 * instead of three near-identical copies of fetch-plus-bearer-header drifting apart across
 * `runs.ts`, `stages.ts` and `metrics.ts`.
 */

export interface RateLimitSnapshot {
  readonly limit: number;
  readonly remaining: number;
  /** Epoch milliseconds. */
  readonly resetAt: number;
}

export interface RateLimitStatus {
  readonly paused: boolean;
  /** ISO timestamp, or `null` when not paused. */
  readonly pausedUntil: string | null;
  readonly remaining: number | null;
  readonly limit: number | null;
}

/** Stop polling once fewer than this fraction of the limit remains, so the last calls before
 *  exhaustion are never the ones that actually hit zero. */
const PAUSE_THRESHOLD = 0.1;

interface CacheEntry {
  readonly etag: string;
  readonly body: unknown;
}

export type TokenFor = (repo: string) => Promise<{ readonly token: string; readonly identity: string }>;

/** An authenticated GitHub REST client: rate-limit aware, ETag-caching, and backing off
 *  instead of retrying on a rate-limited 403/429. Every dependency is constructor-injected
 *  (same pattern as `MetricsCache`) so tests never touch the real network or clock. */
export class ForgeClient {
  private rateLimit: RateLimitSnapshot | undefined;
  private pausedUntil: number | undefined;
  private readonly etagCache = new Map<string, CacheEntry>();
  private identityLogged = false;

  constructor(
    private readonly tokenFor: TokenFor,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly log: (message: string) => void = (message) => console.log(message),
  ) {}

  /** The rate-limit state for `/api/rate-limit` and the dashboard's "data paused until
   *  HH:MM" banner. */
  status(): RateLimitStatus {
    const paused = this.isPaused();
    return {
      paused,
      pausedUntil: paused && this.pausedUntil !== undefined ? new Date(this.pausedUntil).toISOString() : null,
      remaining: this.rateLimit?.remaining ?? null,
      limit: this.rateLimit?.limit ?? null,
    };
  }

  private isPaused(): boolean {
    if (this.pausedUntil === undefined) return false;
    if (this.now() >= this.pausedUntil) {
      this.pausedUntil = undefined;
      return false;
    }
    return true;
  }

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get("x-ratelimit-remaining");
    const limit = headers.get("x-ratelimit-limit");
    const reset = headers.get("x-ratelimit-reset");
    if (remaining === null || limit === null || reset === null) return;

    const snapshot: RateLimitSnapshot = {
      remaining: Number(remaining),
      limit: Number(limit),
      resetAt: Number(reset) * 1000,
    };
    this.rateLimit = snapshot;
    if (snapshot.limit > 0 && snapshot.remaining / snapshot.limit < PAUSE_THRESHOLD) {
      this.pausedUntil = snapshot.resetAt;
    }
  }

  /** `true` when a 403/429 names the rate limit rather than some other reason (a branch
   *  protection check, an abuse-detection block unrelated to the budget, ...) -- those are
   *  left for the caller's own `!response.ok` handling instead of triggering a pause. */
  private async isRateLimited(response: Response): Promise<boolean> {
    if (response.headers.get("x-ratelimit-remaining") === "0") return true;
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter !== null) return true;
    const body = await response.clone().text();
    return /\brate limit/i.test(body);
  }

  private async backOffIfRateLimited(response: Response): Promise<void> {
    if (response.status !== 403 && response.status !== 429) return;
    if (!(await this.isRateLimited(response))) return;
    const reset = response.headers.get("x-ratelimit-reset");
    const retryAfter = response.headers.get("retry-after");
    this.pausedUntil =
      reset !== null ? Number(reset) * 1000
      : retryAfter !== null ? this.now() + Number(retryAfter) * 1000
      : this.now() + 60_000;
  }

  private async authHeaders(repo: string): Promise<Record<string, string>> {
    const { token, identity } = await this.tokenFor(repo);
    if (!this.identityLogged) {
      this.identityLogged = true;
      this.log(`forge: authenticating as ${identity}`);
    }
    return token === "" ? {} : { authorization: `Bearer ${token}` };
  }

  /** `undefined` while paused (no request is made at all -- that is the "stop polling"
   *  requirement), on a rate-limited 403/429 (backed off, not retried), or on any other
   *  non-OK response. Otherwise the parsed JSON body, served from the ETag cache on a `304`
   *  without counting against the limit. */
  async fetchJson<T>(url: string, repo: string): Promise<T | undefined> {
    if (this.isPaused()) return undefined;

    const cached = this.etagCache.get(url);
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(await this.authHeaders(repo)),
      ...(cached === undefined ? {} : { "if-none-match": cached.etag }),
    };

    const response = await this.fetchImpl(url, { headers });
    this.updateRateLimit(response.headers);

    if (response.status === 304 && cached !== undefined) return cached.body as T;

    await this.backOffIfRateLimited(response);
    if (!response.ok) return undefined;

    const body = await response.json() as T;
    const etag = response.headers.get("etag");
    if (etag !== null) this.etagCache.set(url, { etag, body });
    return body;
  }

  /** The same request/response handling as {@link fetchJson}, for the one caller that wants
   *  a plain-text body (a run's job log) rather than JSON. Job logs carry no `etag`, so this
   *  never caches one. */
  async fetchText(url: string, repo: string): Promise<string | undefined> {
    if (this.isPaused()) return undefined;

    const response = await this.fetchImpl(url, {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(await this.authHeaders(repo)),
      },
    });
    this.updateRateLimit(response.headers);

    await this.backOffIfRateLimited(response);
    if (!response.ok) return undefined;

    return response.text();
  }
}

async function defaultTokenFor(repo: string): Promise<{ token: string; identity: string }> {
  const credentials = appCredentialsOf();
  if (credentials !== undefined) {
    try {
      const token = await installationTokenFor(repo, credentials);
      return { token, identity: `GitHub App ${credentials.appId}` };
    } catch (error) {
      console.warn(`forge: GitHub App auth failed (${(error as Error).message}); falling back to GH_TOKEN`);
    }
  }
  const personalToken = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
  return { token: personalToken, identity: personalToken === "" ? "unauthenticated" : "GH_TOKEN" };
}

/** The server's one forge client, wired to the real network, clock and App-or-token auth. */
export const forge = new ForgeClient(defaultTokenFor);
