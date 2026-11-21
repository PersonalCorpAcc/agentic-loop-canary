import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LoopRun } from "../shared/types.js";

vi.mock("./runs.js", () => ({ listRuns: vi.fn() }));
vi.mock("./forge.js", () => ({ forge: { fetchJson: vi.fn(), fetchText: vi.fn() } }));

import { forge } from "./forge.js";
import { MetricsCache, runsWithOutcome, type RepoSnapshot } from "./metrics.js";
import { listRuns } from "./runs.js";

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

function runOf(id: number, finished: boolean): LoopRun {
  return {
    id,
    route: "implement",
    outcome: "unknown",
    reason: "success",
    subject: `#${id}`,
    startedAt: "2026-01-01T00:00:00Z",
    ...(finished ? { finishedAt: "2026-01-01T00:05:00Z" } : {}),
    url: "",
  };
}

describe("caching a completed run's outcome line (#207)", () => {
  beforeEach(() => {
    vi.mocked(listRuns).mockReset();
    vi.mocked(forge.fetchJson).mockReset();
    vi.mocked(forge.fetchText).mockReset();
  });

  it("fetches a completed run's log at most once across repeated refreshes", async () => {
    vi.mocked(listRuns).mockResolvedValue([runOf(301, true)]);
    vi.mocked(forge.fetchJson).mockResolvedValue({ jobs: [{ id: 999 }] });
    vi.mocked(forge.fetchText).mockResolvedValue("outcome=acted route=implement subject=#301 reason=merged");

    await runsWithOutcome("a/one");
    await runsWithOutcome("a/one");
    await runsWithOutcome("a/one");

    expect(forge.fetchText).toHaveBeenCalledTimes(1);
  });

  it("re-fetches a still-in-progress run's log every time, since it is not final yet", async () => {
    vi.mocked(listRuns).mockResolvedValue([runOf(302, false)]);
    vi.mocked(forge.fetchJson).mockResolvedValue({ jobs: [{ id: 998 }] });
    vi.mocked(forge.fetchText).mockResolvedValue(undefined);

    await runsWithOutcome("a/one");
    await runsWithOutcome("a/one");

    expect(forge.fetchText).toHaveBeenCalledTimes(2);
  });

  it("caches a completed run even when the log lookup found nothing, rather than retrying it forever", async () => {
    vi.mocked(listRuns).mockResolvedValue([runOf(303, true)]);
    vi.mocked(forge.fetchJson).mockResolvedValue(undefined);

    await runsWithOutcome("a/one");
    await runsWithOutcome("a/one");

    // The run id this test uses is disjoint from the other tests' in this file, so the cache
    // entry below is solely this test's: looked up once, and not retried on the second call
    // even though that lookup found nothing.
    expect(forge.fetchJson).toHaveBeenCalledTimes(1);
    expect(forge.fetchText).not.toHaveBeenCalled();
  });
});
