import { describe, expect, it } from "vitest";

import { cfdBucketsOf, classifyFlowStage, replayHistory } from "./flow.js";
import type { ApiTimelineEvent } from "./metrics.js";

/**
 * Labels below are taken from real issues in this repository (numbers noted per case) for
 * every row the repo currently has a live example of. Three rows have no live issue to draw
 * from at the time this was written -- `specifying` (no open issue carries `refine`, or
 * `bot-working` without `implement`), `needs-answers` (every issue carrying `review` here also
 * carries `pr-pending`, so a bare `review` case has no live example), and the `held` overlay
 * (no open issue carries `hold` or `rollback`) -- those use the stage table's own label
 * vocabulary directly rather than an invented sequence.
 */

describe("classifyFlowStage", () => {
  it("backlog: an open issue with none of the loop's managed labels, or just triage", () => {
    expect(classifyFlowStage([])).toEqual({ stage: "backlog", held: false });
    expect(classifyFlowStage(["triage"])).toEqual({ stage: "backlog", held: false });
    // #159: refined but never queued for implementation -- nothing further along matches.
    expect(classifyFlowStage(["refined", "sp-21"])).toEqual({ stage: "backlog", held: false });
  });

  it("specifying: refine, or bot-working without implement", () => {
    expect(classifyFlowStage(["refine"])).toEqual({ stage: "specifying", held: false });
    expect(classifyFlowStage(["bot-working"])).toEqual({ stage: "specifying", held: false });
  });

  it("needs-answers: review on the issue itself, no pull request open yet", () => {
    expect(classifyFlowStage(["review"])).toEqual({ stage: "needs-answers", held: false });
  });

  it("ready: refined and implement, not yet bot-working", () => {
    // #141
    expect(classifyFlowStage(["refined", "implement", "sp-5"])).toEqual({ stage: "ready", held: false });
  });

  it("building: implement and bot-working", () => {
    // #161, this story's own issue
    expect(classifyFlowStage(["refined", "implement", "bot-working", "sp-5"])).toEqual({ stage: "building", held: false });
  });

  it("validating: pr-pending reserved on the issue, no review requested yet", () => {
    // #31
    expect(classifyFlowStage(["implement", "pr-pending"])).toEqual({ stage: "validating", held: false });
  });

  it("validating: a linked pull request carrying merge-gate, even without pr-pending on the issue", () => {
    expect(classifyFlowStage(["implement"], { labels: ["merge-gate"], state: "open" }))
      .toEqual({ stage: "validating", held: false });
  });

  it("awaiting-review: pr-pending and review both on the issue", () => {
    // #48
    expect(classifyFlowStage(["implement", "review", "pr-pending"])).toEqual({ stage: "awaiting-review", held: false });
  });

  it("awaiting-review: a linked pull request carrying review", () => {
    expect(classifyFlowStage(["implement", "pr-pending"], { labels: ["review"], state: "open" }))
      .toEqual({ stage: "awaiting-review", held: false });
  });

  it("awaiting-review: a required approval missing, the placeholder for a future review_decision field", () => {
    expect(classifyFlowStage(["implement", "pr-pending"], undefined, true))
      .toEqual({ stage: "awaiting-review", held: false });
  });

  it("deploying: merged-dev and/or merged-test, before merged-main lands", () => {
    // #14, still open
    expect(classifyFlowStage(["merged-dev", "merged-test"])).toEqual({ stage: "deploying", held: false });
    // #24, still open
    expect(classifyFlowStage(["merged-dev"])).toEqual({ stage: "deploying", held: false });
  });

  it("shipped: merged-main", () => {
    // #107's labels, once merged-main landed
    expect(classifyFlowStage(["merged-dev", "merged-test", "merged-main"])).toEqual({ stage: "shipped", held: false });
  });

  it("held: an overlay independent of stage, true for hold or rollback", () => {
    expect(classifyFlowStage(["implement", "bot-working", "hold"])).toEqual({ stage: "building", held: true });
    expect(classifyFlowStage(["refined", "implement", "rollback"])).toEqual({ stage: "ready", held: true });
  });

  it("held: not set by hotfix -- #159 lists only the first two labels for this overlay", () => {
    expect(classifyFlowStage(["implement", "bot-working", "hotfix"])).toEqual({ stage: "building", held: false });
  });
});

describe("replayHistory", () => {
  it("replays labeled/unlabeled events through the same classifier, collapsing non-changing ones", () => {
    const events: ApiTimelineEvent[] = [
      { event: "labeled", label: { name: "refine" }, created_at: "2026-01-01T00:00:00Z" },
      { event: "unlabeled", label: { name: "refine" }, created_at: "2026-01-02T00:00:00Z" },
      // This event does not change the classified stage (refined alone still backlog) and
      // must not produce its own entry.
      { event: "labeled", label: { name: "refined" }, created_at: "2026-01-03T00:00:00Z" },
      { event: "labeled", label: { name: "implement" }, created_at: "2026-01-04T00:00:00Z" },
      { event: "labeled", label: { name: "bot-working" }, created_at: "2026-01-05T00:00:00Z" },
    ];

    const history = replayHistory("2025-12-31T00:00:00Z", ["refined", "implement", "bot-working"], events);

    expect(history).toEqual([
      { stage: "specifying", enteredAt: "2026-01-01T00:00:00Z" },
      { stage: "backlog", enteredAt: "2026-01-02T00:00:00Z" },
      { stage: "ready", enteredAt: "2026-01-04T00:00:00Z" },
      { stage: "building", enteredAt: "2026-01-05T00:00:00Z" },
    ]);
  });

  it("an issue with no timeline events gets one entry at created_at from its current labels", () => {
    const history = replayHistory("2026-01-01T00:00:00Z", ["refined", "implement", "sp-5"], []);
    expect(history).toEqual([{ stage: "ready", enteredAt: "2026-01-01T00:00:00Z" }]);
  });
});

describe("cfdBucketsOf", () => {
  it("counts each item by its stage as of each day, zero explicit for an empty stage", () => {
    const items = [
      {
        history: [
          { stage: "backlog" as const, enteredAt: "2026-01-01T00:00:00Z" },
          { stage: "ready" as const, enteredAt: "2026-01-04T00:00:00Z" },
        ],
      },
      { history: [{ stage: "building" as const, enteredAt: "2026-01-03T00:00:00Z" }] },
    ];

    const buckets = cfdBucketsOf(items, 3, "2026-01-05T12:00:00Z");

    expect(buckets.map((b) => b.date)).toEqual(["2026-01-03", "2026-01-04", "2026-01-05"]);

    expect(buckets[0]!.counts).toMatchObject({ backlog: 1, building: 1, ready: 0, shipped: 0 });
    expect(buckets[1]!.counts).toMatchObject({ backlog: 0, building: 1, ready: 1, shipped: 0 });
    expect(buckets[2]!.counts).toMatchObject({ backlog: 0, building: 1, ready: 1, shipped: 0 });

    // Every stage is an explicit key on every day, not just the ones with a non-zero count.
    for (const bucket of buckets) {
      expect(Object.keys(bucket.counts).sort()).toEqual(
        ["awaiting-review", "backlog", "building", "deploying", "needs-answers", "ready", "shipped", "specifying", "validating"].sort(),
      );
    }
  });
});
