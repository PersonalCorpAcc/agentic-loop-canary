import { describe, expect, it } from "vitest";
import { isRateLimitErrorResponse, RateLimiter } from "./rate-limit.js";

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("RateLimiter.recordHeaders", () => {
  it("pauses once remaining drops below 10% of the limit, until the reset time", () => {
    let now = new Date("2026-11-20T10:00:00Z");
    const limiter = new RateLimiter(() => now);
    const resetAt = new Date("2026-11-20T11:00:00Z");

    limiter.recordHeaders(headersOf({
      "x-ratelimit-remaining": "40",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-reset": String(Math.floor(resetAt.getTime() / 1000)),
    }));
    expect(limiter.isPaused()).toBe(true);
    expect(limiter.snapshot()).toEqual({ pausedUntil: resetAt.toISOString() });

    now = new Date(resetAt.getTime() - 1000);
    expect(limiter.isPaused()).toBe(true);

    now = resetAt;
    expect(limiter.isPaused()).toBe(false);
    expect(limiter.snapshot()).toEqual({ pausedUntil: null });
  });

  it("does not pause while comfortably above the low-water mark", () => {
    const limiter = new RateLimiter();
    limiter.recordHeaders(headersOf({ "x-ratelimit-remaining": "4000", "x-ratelimit-limit": "5000" }));
    expect(limiter.isPaused()).toBe(false);
  });

  it("ignores a response carrying no rate-limit headers", () => {
    const limiter = new RateLimiter();
    limiter.recordHeaders(headersOf({}));
    expect(limiter.isPaused()).toBe(false);
  });
});

describe("RateLimiter.recordRateLimitError", () => {
  it("pauses from the reset header on a 403 rate-limit response, without needing a retry", () => {
    let now = new Date("2026-11-20T10:00:00Z");
    const limiter = new RateLimiter(() => now);
    const resetAt = new Date("2026-11-20T10:05:00Z");

    limiter.recordRateLimitError(headersOf({ "x-ratelimit-reset": String(Math.floor(resetAt.getTime() / 1000)) }));
    expect(limiter.isPaused()).toBe(true);

    now = resetAt;
    expect(limiter.isPaused()).toBe(false);
  });

  it("falls back to a short fixed back-off when the forge sends no reset header", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const limiter = new RateLimiter(() => now);
    limiter.recordRateLimitError(headersOf({}));
    expect(limiter.isPaused()).toBe(true);
  });
});

describe("isRateLimitErrorResponse", () => {
  it("is true for a 403 with x-ratelimit-remaining: 0", () => {
    expect(isRateLimitErrorResponse(403, headersOf({ "x-ratelimit-remaining": "0" }), "")).toBe(true);
  });

  it("is true for a 429 whose body names the rate limit", () => {
    expect(isRateLimitErrorResponse(429, headersOf({}), "You have exceeded a secondary rate limit")).toBe(true);
  });

  it("is false for an ordinary 403 permission error", () => {
    expect(isRateLimitErrorResponse(403, headersOf({}), "Resource not accessible by integration")).toBe(false);
  });

  it("is false for a non-403/429 status", () => {
    expect(isRateLimitErrorResponse(404, headersOf({ "x-ratelimit-remaining": "0" }), "")).toBe(false);
  });
});
