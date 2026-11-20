import { authHeaders, type AuthConfig } from "./github-app.js";
import { isRateLimitErrorResponse, rateLimiter, type RateLimiter } from "./rate-limit.js";

/**
 * The one place every GitHub REST read in this server goes through: it attaches the right
 * identity (App or personal token, see `github-app.ts`), sends `If-None-Match` when an
 * earlier request already cached a body for this exact path, tracks the forge's own
 * `x-ratelimit-*` headers on every response, and refuses to make the request at all once
 * those headers said to stop. Replaces the duplicated `fetch` calls and header-building in
 * `runs.ts`, `metrics.ts` and `stages.ts`.
 */

export interface ForgeResponse<T> {
  readonly status: number;
  readonly body: T | undefined;
}

interface ETagEntry {
  readonly etag: string;
  readonly body: unknown;
}

const etags = new Map<string, ETagEntry>();

export type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

/** Every dependency a real call picks up from the globals, overridable only for a test. */
export interface ForgeDeps {
  readonly fetchImpl?: Fetcher;
  readonly authConfig?: AuthConfig;
  readonly limiter?: RateLimiter;
}

async function requestHeaders(repo: string, deps: ForgeDeps, extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const owner = repo.split("/")[0]!;
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...await authHeaders(owner, repo, deps.authConfig),
    ...extra,
  };
}

function recordResponse(limiter: RateLimiter, response: Response, bodyText: string): void {
  limiter.recordHeaders(response.headers);
  if ((response.status === 403 || response.status === 429) && isRateLimitErrorResponse(response.status, response.headers, bodyText)) {
    limiter.recordRateLimitError(response.headers);
  }
}

/** A `GET https://api.github.com/repos/{repo}{path}` for a caller that needs the raw
 *  `Response` rather than a parsed JSON body -- the job-log endpoint returns plain text, not
 *  JSON, so it cannot go through {@link forgeGet}. `undefined` while the rate limit is
 *  paused, the same "nothing new this tick" sentinel {@link forgeGet} uses. */
export async function forgeFetch(path: string, repo: string, deps: ForgeDeps = {}): Promise<Response | undefined> {
  const limiter = deps.limiter ?? rateLimiter;
  if (limiter.isPaused()) return undefined;

  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = `https://api.github.com/repos/${repo}${path}`;
  const response = await fetchImpl(url, { headers: await requestHeaders(repo, deps) });

  const bodyText = response.status === 403 || response.status === 429
    ? await response.clone().text().catch(() => "")
    : "";
  recordResponse(limiter, response, bodyText);
  return response;
}

/** A `GET https://api.github.com/repos/{repo}{path}`, the same base every caller already
 *  built by hand. `status` is `0` with no `body` when the rate limit is currently paused:
 *  the sentinel every caller already treats a failed fetch as -- nothing new this tick,
 *  never a thrown error, since a paused tick is routine rather than exceptional. */
export async function forgeGet<T>(path: string, repo: string, deps: ForgeDeps = {}): Promise<ForgeResponse<T>> {
  const limiter = deps.limiter ?? rateLimiter;
  if (limiter.isPaused()) return { status: 0, body: undefined };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = `https://api.github.com/repos/${repo}${path}`;
  const cached = etags.get(url);
  const headers = await requestHeaders(repo, deps, cached === undefined ? {} : { "if-none-match": cached.etag });

  const response = await fetchImpl(url, { headers });

  if (response.status === 403 || response.status === 429) {
    const bodyText = await response.text().catch(() => "");
    recordResponse(limiter, response, bodyText);
    return { status: response.status, body: undefined };
  }
  recordResponse(limiter, response, "");

  if (response.status === 304) {
    return { status: 304, body: cached?.body as T | undefined };
  }

  if (!response.ok) return { status: response.status, body: undefined };

  const body = await response.json() as T;
  const etag = response.headers.get("etag");
  if (etag !== null) etags.set(url, { etag, body });
  return { status: response.status, body };
}
