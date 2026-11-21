import { describe, expect, it, vi } from "vitest";

import { ForgeClient } from "./forge.js";

function tokenFor(token = "the-token", identity = "GH_TOKEN") {
  return vi.fn(async () => ({ token, identity }));
}

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), { status: init?.status ?? 200, ...(init?.headers === undefined ? {} : { headers: init.headers }) });
}

describe("a forge client's rate-limit bookkeeping", () => {
  it("stops polling once fewer than 10% of the limit remains, until the reset", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: true }, { headers: { "x-ratelimit-limit": "100", "x-ratelimit-remaining": "9", "x-ratelimit-reset": "1700000100" } }),
    );
    let now = 1_700_000_000_000;
    const client = new ForgeClient(tokenFor(), fetchImpl as unknown as typeof fetch, () => now, () => {});

    await client.fetchJson("https://api.github.com/x", "a/b");
    expect(client.status().paused).toBe(true);
    expect(client.status().pausedUntil).toBe(new Date(1_700_000_100_000).toISOString());

    // While paused, a further call makes no request at all -- the "stop polling" requirement.
    const result = await client.fetchJson("https://api.github.com/y", "a/b");
    expect(result).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Past the reset, polling resumes.
    now = 1_700_000_200_000;
    expect(client.status().paused).toBe(false);
    await client.fetchJson("https://api.github.com/y", "a/b");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("backs off rather than retrying on a rate-limited 403", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("API rate limit exceeded for user", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000100" },
      }),
    );
    const now = () => 1_700_000_000_000;
    const client = new ForgeClient(tokenFor(), fetchImpl as unknown as typeof fetch, now, () => {});

    const result = await client.fetchJson("https://api.github.com/x", "a/b");
    expect(result).toBeUndefined();
    expect(client.status().paused).toBe(true);

    await client.fetchJson("https://api.github.com/x", "a/b");
    // The second call found the client already paused and made no further request.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("backs off on a 429 naming retry-after when no rate-limit header is present", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limit exceeded", { status: 429, headers: { "retry-after": "30" } }));
    const now = () => 1_700_000_000_000;
    const client = new ForgeClient(tokenFor(), fetchImpl as unknown as typeof fetch, now, () => {});

    await client.fetchJson("https://api.github.com/x", "a/b");
    expect(client.status().paused).toBe(true);
    expect(client.status().pausedUntil).toBe(new Date(1_700_000_030_000).toISOString());
  });

  it("does not back off on a 403 unrelated to the rate limit", async () => {
    const fetchImpl = vi.fn(async () => new Response("Resource not accessible by integration", { status: 403 }));
    const client = new ForgeClient(tokenFor(), fetchImpl as unknown as typeof fetch, () => 0, () => {});

    const result = await client.fetchJson("https://api.github.com/x", "a/b");
    expect(result).toBeUndefined();
    expect(client.status().paused).toBe(false);
  });
});

describe("a forge client's conditional requests", () => {
  it("sends the stored ETag as If-None-Match, and a 304 reuses the cached body without counting against the limit", async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ value: 1 }, { headers: { etag: "\"abc\"" } }))
      .mockImplementationOnce(async (_url: string, init: { headers: Record<string, string> }) => {
        expect(init.headers["if-none-match"]).toBe("\"abc\"");
        return new Response(null, { status: 304 });
      });
    const client = new ForgeClient(tokenFor(), fetchImpl as unknown as typeof fetch, () => 0, () => {});

    const first = await client.fetchJson<{ value: number }>("https://api.github.com/x", "a/b");
    expect(first).toEqual({ value: 1 });

    const second = await client.fetchJson<{ value: number }>("https://api.github.com/x", "a/b");
    expect(second).toEqual({ value: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("a forge client's identity", () => {
  it("logs which identity it authenticates as, once", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const log = vi.fn();
    const client = new ForgeClient(tokenFor("t", "GitHub App 1"), fetchImpl as unknown as typeof fetch, () => 0, log);

    await client.fetchJson("https://api.github.com/x", "a/b");
    await client.fetchJson("https://api.github.com/y", "a/b");

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("forge: authenticating as GitHub App 1");
  });
});
