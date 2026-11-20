/**
 * The forge's own rate-limit budget, read off every response's `x-ratelimit-*` headers
 * rather than tracked independently -- the forge is the only source of truth for how much
 * of it is left. In memory only, like everything else this server holds (see
 * ARCHITECTURE.md): a restart starts fresh, and the next request's own headers say where
 * the budget actually stands.
 */

const LOW_WATER_MARK = 0.1;
const DEFAULT_BACKOFF_MS = 60_000;

export class RateLimiter {
  private remaining: number | undefined;
  private limit: number | undefined;
  private resetAt: Date | undefined;
  private pausedUntil: Date | undefined;

  constructor(private readonly now: () => Date = () => new Date()) {}

  /** Every response's own rate-limit headers, successful or not. Below the 10% low-water
   *  mark this pauses polling until the forge's own reset time -- or, lacking a reset
   *  header, a short fixed back-off -- rather than this module inventing its own window. */
  recordHeaders(headers: Headers): void {
    const remainingHeader = headers.get("x-ratelimit-remaining");
    const limitHeader = headers.get("x-ratelimit-limit");
    if (remainingHeader === null || limitHeader === null) return;
    const resetHeader = headers.get("x-ratelimit-reset");

    this.remaining = Number(remainingHeader);
    this.limit = Number(limitHeader);
    this.resetAt = resetHeader === null ? undefined : new Date(Number(resetHeader) * 1000);

    if (this.limit > 0 && this.remaining / this.limit < LOW_WATER_MARK) {
      this.pausedUntil = this.resetAt ?? new Date(this.now().getTime() + DEFAULT_BACKOFF_MS);
    }
  }

  /** A 403 or 429 the forge sent for exhausting the rate limit rather than, say, a missing
   *  permission: backed off rather than retried, using the same reset header a successful
   *  response carries when the forge sends one. */
  recordRateLimitError(headers: Headers): void {
    const resetHeader = headers.get("x-ratelimit-reset");
    this.pausedUntil = resetHeader === null
      ? new Date(this.now().getTime() + DEFAULT_BACKOFF_MS)
      : new Date(Number(resetHeader) * 1000);
  }

  /** Whether polling should stop. A pause past its own reset time clears itself here: the
   *  next request's own headers are what say where the budget stands again, not a timer. */
  isPaused(): boolean {
    if (this.pausedUntil === undefined) return false;
    if (this.now() >= this.pausedUntil) {
      this.pausedUntil = undefined;
      return false;
    }
    return true;
  }

  /** What `/api/rate-limit` serves: never a live forge fetch, only ever this state. */
  snapshot(): { pausedUntil: string | null } {
    return { pausedUntil: this.isPaused() ? this.pausedUntil!.toISOString() : null };
  }
}

/** A 403/429 the forge sent specifically for the rate limit -- either it says so directly
 *  (`x-ratelimit-remaining: 0`) or its body names it, as opposed to an ordinary permission
 *  or not-found error that happens to share the status code. */
export function isRateLimitErrorResponse(status: number, headers: Headers, bodyText: string): boolean {
  if (status !== 403 && status !== 429) return false;
  if (headers.get("x-ratelimit-remaining") === "0") return true;
  return /rate limit/i.test(bodyText);
}

/** The one rate-limit state the whole server shares: every forge call updates it, and the
 *  poll loops and `/api/rate-limit` only ever read it. */
export const rateLimiter = new RateLimiter();
