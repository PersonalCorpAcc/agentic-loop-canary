import { afterEach, describe, expect, it, vi } from "vitest";

import { MetricsCache, runsWithOutcome, type RepoSnapshot } from "./metrics.js";

function snapshotOf(repo: string): RepoSnapshot {
  return { repo, issues: [], pullRequests: [], labels: [], runs: [], issueTimelines: {} };
}

describe("the per-repository metrics cache", () => {
  it("has nothing cached before the first refresh", () => {
    const cache = new MetricsCache(["a/one"], async (repo) => snapshotOf(repo));
    expect(cache.get("a/one")).toBeUndefined();
  });

  it("a scheduled refresh replaces a repository's cached snapshot", async () => {
    let call = 0;
    const cache = new MetricsCache(["a/one"], async (repo) => {
      call += 1;
      return {
        ...snapshotOf(repo),
        issues: [{ number: call, title: "t", state: "open", html_url: "", created_at: "2026-01-01T00:00:00Z", labels: [] }],
      };
    }, () => "fixed-time");

    await cache.refresh();
    expect(cache.get("a/one")?.snapshot?.issues[0]?.number).toBe(1);

    await cache.refresh();
    expect(cache.get("a/one")?.snapshot?.issues[0]?.number).toBe(2);
    expect(cache.get("a/one")?.refreshedAt).toBe("fixed-time");
  });

  it("one repository's failed fetch leaves every other repository's cache untouched", async () => {
    const cache = new MetricsCache(
      ["a/good", "a/bad"],
      async (repo) => {
        if (repo === "a/bad") throw new Error("the forge answered 403");
        return snapshotOf(repo);
      },
    );

    await cache.refresh();
    expect(cache.get("a/good")?.ok).toBe(true);
    expect(cache.get("a/good")?.snapshot).toBeDefined();
    expect(cache.get("a/bad")?.ok).toBe(false);
    expect(cache.get("a/bad")?.snapshot).toBeUndefined();
  });

  it("a request mid-refresh reads the previous snapshot rather than waiting on it", async () => {
    let resolveFetch: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { resolveFetch = resolve; });
    let fetches = 0;
    const cache = new MetricsCache(["a/one"], async (repo) => {
      fetches += 1;
      if (fetches === 2) await gate;
      return snapshotOf(repo);
    });

    await cache.refresh();
    const before = cache.get("a/one");
    expect(before).toBeDefined();

    const inFlight = cache.refresh();
    // The second refresh is still awaiting its fetch: a read right now must see the first
    // refresh's result, not block on the second.
    expect(cache.get("a/one")).toBe(before);

    resolveFetch?.();
    await inFlight;
  });
});

describe("a completed run's log", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is fetched at most once across two runsWithOutcome calls for the same run id", async () => {
    const runId = 990001;
    const jobsUrl = `https://api.github.com/repos/a/one/actions/runs/${runId}/jobs`;
    const logsUrl = "https://api.github.com/repos/a/one/actions/jobs/55/logs";
    let logFetches = 0;

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("https://api.github.com/repos/a/one/actions/runs?")) {
        return new Response(JSON.stringify({
          workflow_runs: [{
            id: runId,
            name: "Work Router",
            display_title: "dispatch: implement",
            status: "completed",
            conclusion: "success",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:05:00Z",
            html_url: "https://github.com/a/one/actions/runs/1",
          }],
        }), { status: 200 });
      }
      if (url === jobsUrl) return new Response(JSON.stringify({ jobs: [{ id: 55 }] }), { status: 200 });
      if (url === logsUrl) {
        logFetches += 1;
        return new Response("outcome=acted route=implement subject=#1 reason=did-a-thing", { status: 200 });
      }
      throw new Error(`unexpected request: ${url}`);
    }));

    const first = await runsWithOutcome("a/one");
    expect(first[0]?.outcome).toBe("acted");
    expect(logFetches).toBe(1);

    const second = await runsWithOutcome("a/one");
    expect(second[0]?.outcome).toBe("acted");
    expect(logFetches).toBe(1);
  });
});
