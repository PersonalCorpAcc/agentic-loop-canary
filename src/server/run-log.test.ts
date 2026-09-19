import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { outcomeFor, resetOutcomeCache } from "./run-log.js";

/**
 * `outcomeFor` makes two requests per run -- the jobs list, then that job's log -- so each
 * fixture below is the pair a real run produces, in order.
 */
function jobsResponse(jobId: number): Response {
  return new Response(JSON.stringify({ jobs: [{ id: jobId }] }), { status: 200 });
}

/** A router run's jobs list -- several jobs, in the order the forge reports them. */
function multiJobsResponse(jobIds: number[]): Response {
  return new Response(JSON.stringify({ jobs: jobIds.map((id) => ({ id })) }), { status: 200 });
}

function logResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe("reading a run's outcome from its own log", () => {
  beforeEach(() => {
    resetOutcomeCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds the outcome line inside a real log", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jobsResponse(101))
      .mockResolvedValueOnce(logResponse(
        "##[group]Run bash record-outcome.sh\n" +
          "outcome=acted route=merge-gate subject=#25 reason=merge-armed -- The pull request is marked ready.\n",
      ));

    const outcome = await outcomeFor(1);

    expect(outcome).toMatchObject({ outcome: "acted", route: "merge-gate", subject: "#25", reason: "merge-armed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("finds the outcome line on the last job of a router run, not just the first", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(multiJobsResponse([201, 202, 203]))
      .mockResolvedValueOnce(logResponse("Run bash route.sh\nRouted to conclude.\n"))
      .mockResolvedValueOnce(logResponse("Run bash worker.sh\nDid the work.\n"))
      .mockResolvedValueOnce(logResponse(
        "outcome=acted route=merge-gate subject=#25 reason=merge-armed -- The pull request is marked ready.\n",
      ));

    const outcome = await outcomeFor(6);

    expect(outcome).toMatchObject({ outcome: "acted", route: "merge-gate", reason: "merge-armed" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps a run whose log has no outcome line, rather than dropping it", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jobsResponse(102))
      .mockResolvedValueOnce(logResponse("Run actions/checkout@v7\nDone.\n"));

    await expect(outcomeFor(2)).resolves.toBeUndefined();
  });

  it("returns undefined, not a throw, when the fetch fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(outcomeFor(3)).resolves.toBeUndefined();
  });

  it("fetches a run's log at most once, serving the cache after that", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jobsResponse(103))
      .mockResolvedValueOnce(logResponse(
        "outcome=no-action route=promote subject=- reason=soak-pending -- waited 3m of 5m.\n",
      ));

    const first = await outcomeFor(4);
    const second = await outcomeFor(4);

    expect(first).toMatchObject({ reason: "soak-pending" });
    expect(second).toMatchObject({ reason: "soak-pending" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed fetch, so the next poll can try again", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    fetchMock
      .mockResolvedValueOnce(jobsResponse(104))
      .mockResolvedValueOnce(logResponse("outcome=failed route=implement subject=#9 reason=build-broken\n"));

    const first = await outcomeFor(5);
    const second = await outcomeFor(5);

    expect(first).toBeUndefined();
    expect(second).toMatchObject({ reason: "build-broken" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
