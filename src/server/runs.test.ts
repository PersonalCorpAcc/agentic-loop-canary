import { afterEach, describe, expect, it, vi } from "vitest";

import { listRuns, routeOf, RunsFetchError, subjectOf } from "./runs.js";

function fakeResponse(init: { ok: boolean; status?: number; remaining?: string; body?: unknown }): Response {
  const headers = new Headers();
  if (init.remaining !== undefined) headers.set("x-ratelimit-remaining", init.remaining);
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    headers,
    json: () => Promise.resolve(init.body ?? { workflow_runs: [] }),
  } as Response;
}

/**
 * Real run titles, taken from this repository's own Actions history. The router names every
 * run it starts, and those names are the only thing the run list knows about which route a
 * run belongs to -- which is also why the loop's own guidance calls title matching a
 * pre-filter rather than a guarantee (D4).
 */
describe("reading a route out of a run title", () => {
  it.each([
    ["Working (Implement): Add IsPrerelease to the semver package (#24)", "implement"],
    ["Working (Merge Gate): PR #25", "merge-gate"],
    ["dispatch: reconcile-bot-pr-runs", "reconcile-bot-pr-runs"],
    ["dispatch: sync-stages", "sync-stages"],
  ])("reads %s as %s", (title, route) => {
    expect(routeOf({ name: "Work Router", display_title: title })).toBe(route);
  });

  it("falls back to the workflow's name when the title says nothing", () => {
    expect(routeOf({ name: "CI", display_title: "Add IsPrerelease to the semver package" })).toBe("CI");
  });

  it("finds the issue or pull request a run is about", () => {
    expect(subjectOf("Working (Merge Gate): PR #25")).toBe("#25");
    expect(subjectOf("Working (Implement): Add IsPrerelease (#24)")).toBe("#24");
    expect(subjectOf("dispatch: promote")).toBe("-");
  });
});

describe("reading the forge's rate-limit signal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carries x-ratelimit-remaining back on a success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ ok: true, remaining: "42" })));
    const result = await listRuns();
    expect(result.rateLimitRemaining).toBe(42);
    expect(result.runs).toEqual([]);
  });

  it("flags a 403 as rate limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 403 })));
    await expect(listRuns()).rejects.toMatchObject({ rateLimited: true } satisfies Partial<RunsFetchError>);
  });

  it("flags a 429 as rate limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 429 })));
    await expect(listRuns()).rejects.toMatchObject({ rateLimited: true } satisfies Partial<RunsFetchError>);
  });

  it("does not call an unrelated failure rate limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 500 })));
    await expect(listRuns()).rejects.toMatchObject({ rateLimited: false } satisfies Partial<RunsFetchError>);
  });
});
