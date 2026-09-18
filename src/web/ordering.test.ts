import { describe, expect, it } from "vitest";

import type { LoopRun } from "../shared/types.js";
import { compareRuns } from "./ordering.js";

/**
 * Real run shapes, taken from this repository's own Actions history: a router run that
 * handed off, a merge gate that failed, a run still going, and finished history.
 */
const handedToHuman: LoopRun = {
  id: 24,
  route: "implement",
  outcome: "handed-to-human",
  reason: "too-unclear",
  subject: "#24",
  startedAt: "2026-09-15T09:00:00Z",
  finishedAt: "2026-09-15T09:04:00Z",
  url: "https://github.com/PersonalCorpAcc/agentic-loop-canary/actions/runs/1",
};

const failed: LoopRun = {
  id: 25,
  route: "merge-gate",
  outcome: "failed",
  reason: "verification-failed",
  subject: "#25",
  startedAt: "2026-09-14T09:00:00Z",
  finishedAt: "2026-09-14T09:03:00Z",
  url: "https://github.com/PersonalCorpAcc/agentic-loop-canary/actions/runs/2",
};

const running: LoopRun = {
  id: 26,
  route: "promote",
  outcome: "unknown",
  reason: "in_progress",
  subject: "-",
  startedAt: "2026-09-16T09:00:00Z",
  url: "https://github.com/PersonalCorpAcc/agentic-loop-canary/actions/runs/3",
};

const finished: LoopRun = {
  id: 23,
  route: "merge-gate",
  outcome: "acted",
  reason: "merged",
  subject: "#23",
  startedAt: "2026-09-13T09:00:00Z",
  finishedAt: "2026-09-13T09:03:00Z",
  url: "https://github.com/PersonalCorpAcc/agentic-loop-canary/actions/runs/4",
};

const olderFinished: LoopRun = {
  id: 22,
  route: "promote",
  outcome: "no-action",
  reason: "nothing-to-promote",
  subject: "-",
  startedAt: "2026-09-10T09:00:00Z",
  finishedAt: "2026-09-10T09:01:00Z",
  url: "https://github.com/PersonalCorpAcc/agentic-loop-canary/actions/runs/5",
};

describe("ordering runs so the one a person must act on sorts first", () => {
  it("puts anything waiting for a person ahead of everything else", () => {
    const ordered = [finished, running, failed, handedToHuman].sort(compareRuns);
    expect(ordered.slice(0, 2)).toEqual(
      expect.arrayContaining([handedToHuman, failed]),
    );
    expect(ordered.slice(2)).toEqual([running, finished]);
  });

  it("orders two runs that both need a person by newest first", () => {
    expect([failed, handedToHuman].sort(compareRuns)).toEqual([handedToHuman, failed]);
  });

  it("puts a still-running run ahead of finished history once attention is equal", () => {
    expect([finished, running].sort(compareRuns)).toEqual([running, finished]);
  });

  it("falls back to newest first among finished history", () => {
    expect([olderFinished, finished].sort(compareRuns)).toEqual([finished, olderFinished]);
  });
});
