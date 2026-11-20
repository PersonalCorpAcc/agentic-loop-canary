import { describe, expect, it, vi } from "vitest";
import { forgeGet } from "./forge.js";
import { RateLimiter } from "./rate-limit.js";

function response(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers ?? {} });
}

describe("forgeGet", () => {
  it("sends If-None-Match on the second request and reuses the cached body on a 304 without clearing the ETag", async () => {
    const path = `/runs?per_page=1&_t=${Math.random()}`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ runs: [1] }, { headers: { etag: "etag-abc" } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const first = await forgeGet<{ runs: number[] }>(path, "acme/widgets", { fetchImpl, authConfig: { personalToken: "t" } });
    expect(first).toEqual({ status: 200, body: { runs: [1] } });

    const second = await forgeGet<{ runs: number[] }>(path, "acme/widgets", { fetchImpl, authConfig: { personalToken: "t" } });
    expect(second).toEqual({ status: 304, body: { runs: [1] } });

    const secondRequestHeaders = fetchImpl.mock.calls[1]![1].headers as Record<string, string>;
    expect(secondRequestHeaders["if-none-match"]).toBe("etag-abc");

    const third = await forgeGet<{ runs: number[] }>(path, "acme/widgets", {
      fetchImpl: vi.fn().mockResolvedValueOnce(new Response(null, { status: 304 })),
      authConfig: { personalToken: "t" },
    });
    expect(third).toEqual({ status: 304, body: { runs: [1] } });
  });

  it("does not fetch at all while the rate limiter is paused", async () => {
    const path = `/runs?_t=${Math.random()}`;
    const limiter = new RateLimiter(() => new Date("2026-11-20T10:00:00Z"));
    limiter.recordHeaders(new Headers({ "x-ratelimit-remaining": "1", "x-ratelimit-limit": "5000" }));
    const fetchImpl = vi.fn();

    const result = await forgeGet(path, "acme/widgets", { fetchImpl, limiter, authConfig: { personalToken: "t" } });

    expect(result).toEqual({ status: 0, body: undefined });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("records a rate-limit back-off on a 403 that names the rate limit, without retrying", async () => {
    const path = `/runs?_t=${Math.random()}`;
    const limiter = new RateLimiter(() => new Date("2026-11-20T10:00:00Z"));
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response("API rate limit exceeded", { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
    );

    const result = await forgeGet(path, "acme/widgets", { fetchImpl, limiter, authConfig: { personalToken: "t" } });

    expect(result).toEqual({ status: 403, body: undefined });
    expect(limiter.isPaused()).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not treat an ordinary 403 permission error as a rate-limit back-off", async () => {
    const path = `/runs?_t=${Math.random()}`;
    const limiter = new RateLimiter(() => new Date("2026-11-20T10:00:00Z"));
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response("Resource not accessible by integration", { status: 403 }),
    );

    const result = await forgeGet(path, "acme/widgets", { fetchImpl, limiter, authConfig: { personalToken: "t" } });

    expect(result).toEqual({ status: 403, body: undefined });
    expect(limiter.isPaused()).toBe(false);
  });
});
