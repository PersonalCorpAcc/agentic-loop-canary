import { describe, expect, it } from "vitest";

import {
  buildFlow,
  cfdBuckets,
  classifyFlowStage,
  parsePeriod,
  replayFlowStageHistory,
  stageAt,
  stageDurations,
} from "./flow.js";
import type { ApiIssue, ApiPullRequest, RepoSnapshot, TimelineEvent } from "./metrics.js";

describe("classifying a flow stage off an issue's own labels", () => {
  // #162/#163/#165/#166, this repository's own in-flight sub-issues of #159 while this
  // story was being implemented.
  it("is building for refined + implement + bot-working", () => {
    expect(classifyFlowStage(["refined", "implement", "bot-working", "sp-3"]).stage).toBe("building");
  });

  // #164, a sibling sub-issue refined and queued but not yet picked up by a bot run.
  it("is ready for refined + implement without bot-working", () => {
    expect(classifyFlowStage(["refined", "implement", "sp-3"]).stage).toBe("ready");
  });

  // #48/#30/#21/#11/#5/#3, open issues this repository actually carries a `review` label on.
  it("is needs-answers for review on the issue itself", () => {
    expect(classifyFlowStage(["implement", "review", "sp-2"]).stage).toBe("needs-answers");
  });

  it("is specifying for refine, or bot-working without implement", () => {
    expect(classifyFlowStage(["refine"]).stage).toBe("specifying");
    expect(classifyFlowStage(["bot-working"]).stage).toBe("specifying");
  });

  it("is backlog for a freshly triaged issue with none of the lifecycle labels", () => {
    expect(classifyFlowStage(["triage"]).stage).toBe("backlog");
    expect(classifyFlowStage([]).stage).toBe("backlog");
  });

  // #107/#97/#96/#47/#8, this repository's own fully-shipped closed issues.
  it("is shipped once merged-main lands, or the issue is simply closed", () => {
    expect(classifyFlowStage(["merged-dev", "merged-test", "merged-main"]).stage).toBe("shipped");
    expect(classifyFlowStage(["implement"], undefined, "closed").stage).toBe("shipped");
  });

  it("is deploying once merged-dev or merged-test lands but not yet merged-main", () => {
    expect(classifyFlowStage(["merged-dev"]).stage).toBe("deploying");
    expect(classifyFlowStage(["merged-dev", "merged-test"]).stage).toBe("deploying");
  });

  it("is awaiting-review for an open linked PR carrying review, or missing a required approval", () => {
    expect(classifyFlowStage(["implement"], { labels: ["review"], state: "open" }).stage).toBe("awaiting-review");
    expect(
      classifyFlowStage(["implement"], { labels: [], state: "open", reviewDecision: "REVIEW_REQUIRED" }).stage,
    ).toBe("awaiting-review");
  });

  it("is validating for an open linked PR carrying pr-pending or merge-gate", () => {
    expect(classifyFlowStage(["implement"], { labels: ["pr-pending"], state: "open" }).stage).toBe("validating");
    expect(classifyFlowStage(["implement"], { labels: ["merge-gate"], state: "open" }).stage).toBe("validating");
  });

  it("a closed linked PR never satisfies validating or awaiting-review", () => {
    expect(classifyFlowStage(["refined", "implement"], { labels: ["pr-pending"], state: "closed" }).stage).toBe(
      "ready",
    );
  });
});

describe("the held overlay", () => {
  it("is held for hold or rollback, independent of the classified stage", () => {
    expect(classifyFlowStage(["refined", "implement", "bot-working", "hold"]).held).toBe(true);
    expect(classifyFlowStage(["merged-dev", "rollback"]).held).toBe(true);
  });

  it("is not held for hotfix -- that label blocks a promotion, not a flow stage", () => {
    expect(classifyFlowStage(["merged-dev", "hotfix"]).held).toBe(false);
  });

  it("is not held for an issue carrying none of the three", () => {
    expect(classifyFlowStage(["refined", "implement"]).held).toBe(false);
  });
});

describe("replaying an issue's label timeline into a stage history", () => {
  it("reproduces the expected sequence, oldest first", () => {
    const events: TimelineEvent[] = [
      { event: "labeled", created_at: "2026-01-02T00:00:00Z", label: { name: "refine" } },
      { event: "labeled", created_at: "2026-01-03T00:00:00Z", label: { name: "refined" } },
      { event: "labeled", created_at: "2026-01-03T00:00:01Z", label: { name: "implement" } },
      { event: "unlabeled", created_at: "2026-01-03T00:00:02Z", label: { name: "refine" } },
      { event: "labeled", created_at: "2026-01-04T00:00:00Z", label: { name: "bot-working" } },
    ];

    const history = replayFlowStageHistory(events, {
      labels: ["refined", "implement", "bot-working"],
      createdAt: "2026-01-01T00:00:00Z",
    });

    expect(history).toEqual([
      { stage: "backlog", enteredAt: "2026-01-01T00:00:00Z" },
      { stage: "specifying", enteredAt: "2026-01-02T00:00:00Z" },
      { stage: "ready", enteredAt: "2026-01-03T00:00:01Z" },
      { stage: "building", enteredAt: "2026-01-04T00:00:00Z" },
    ]);
  });

  it("collapses consecutive events that do not change the classified stage", () => {
    const events: TimelineEvent[] = [
      { event: "labeled", created_at: "2026-01-02T00:00:00Z", label: { name: "sp-3" } },
      { event: "labeled", created_at: "2026-01-03T00:00:00Z", label: { name: "refine" } },
    ];

    const history = replayFlowStageHistory(events, { labels: ["refine", "sp-3"], createdAt: "2026-01-01T00:00:00Z" });

    expect(history).toEqual([
      { stage: "backlog", enteredAt: "2026-01-01T00:00:00Z" },
      { stage: "specifying", enteredAt: "2026-01-03T00:00:00Z" },
    ]);
  });

  it("falls back to a single entry at created_at when there are no timeline events", () => {
    const history = replayFlowStageHistory([], { labels: ["refined", "implement"], createdAt: "2026-01-05T00:00:00Z" });
    expect(history).toEqual([{ stage: "ready", enteredAt: "2026-01-05T00:00:00Z" }]);
  });

  it("stageAt looks up the stage as of an arbitrary point in time", () => {
    const history = [
      { stage: "backlog" as const, enteredAt: "2026-01-01T00:00:00Z" },
      { stage: "ready" as const, enteredAt: "2026-01-03T00:00:00Z" },
    ];
    expect(stageAt(history, "2026-01-02T00:00:00Z")).toBe("backlog");
    expect(stageAt(history, "2026-01-03T00:00:00Z")).toBe("ready");
    expect(stageAt(history, "2025-12-31T00:00:00Z")).toBeUndefined();
  });
});

describe("computing per-stage durations off a replayed history (#165)", () => {
  it("is the gap to the next entry, or to now for the last one", () => {
    const history = [
      { stage: "specifying" as const, enteredAt: "2026-01-01T00:00:00Z" },
      { stage: "building" as const, enteredAt: "2026-01-02T00:00:00Z" },
      { stage: "deploying" as const, enteredAt: "2026-01-03T00:00:00Z" },
    ];

    const durations = stageDurations(history, "2026-01-04T00:00:00Z");

    expect(durations.specifying).toBe(86_400_000);
    expect(durations.building).toBe(86_400_000);
    expect(durations.deploying).toBe(86_400_000);
    expect(durations.backlog).toBe(0);
    expect(durations.shipped).toBe(0);
    const total = Object.values(durations).reduce((sum, ms) => sum + ms, 0);
    expect(total).toBe(new Date("2026-01-04T00:00:00Z").getTime() - new Date("2026-01-01T00:00:00Z").getTime());
  });

  it("keeps an explicit 0 for a zero-gap entry instead of dropping it", () => {
    const history = [
      { stage: "specifying" as const, enteredAt: "2026-01-01T00:00:00Z" },
      { stage: "needs-answers" as const, enteredAt: "2026-01-01T12:00:00Z" },
      { stage: "specifying" as const, enteredAt: "2026-01-01T12:00:00Z" },
      { stage: "building" as const, enteredAt: "2026-01-02T00:00:00Z" },
    ];

    const durations = stageDurations(history, "2026-01-02T00:00:00Z");

    expect(durations["needs-answers"]).toBe(0);
    expect(durations.specifying).toBe(86_400_000);
    expect(durations.building).toBe(0);
  });
});

describe("day-bucketing a CFD", () => {
  it("includes an explicit 0 for a stage with no items on a day", () => {
    const items = [
      { history: [{ stage: "backlog" as const, enteredAt: "2026-01-01T00:00:00Z" }] },
      { history: [{ stage: "building" as const, enteredAt: "2026-01-03T00:00:00Z" }] },
    ];

    const buckets = cfdBuckets(items, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));

    expect(buckets.map((bucket) => bucket.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(buckets[0]?.counts).toMatchObject({ backlog: 1, building: 0, shipped: 0 });
    expect(buckets[1]?.counts).toMatchObject({ backlog: 1, building: 0 });
    expect(buckets[2]?.counts).toMatchObject({ backlog: 1, building: 1 });
  });
});

describe("parsing the period query string", () => {
  it("defaults to 30 days", () => {
    expect(parsePeriod(undefined)).toEqual({ days: 30 });
    expect(parsePeriod(null)).toEqual({ days: 30 });
  });

  it("reads an explicit day count or 'all'", () => {
    expect(parsePeriod("7d")).toEqual({ days: 7 });
    expect(parsePeriod("all")).toEqual({ all: true });
  });
});

function issue(partial: Partial<ApiIssue> & Pick<ApiIssue, "number">): ApiIssue {
  return {
    title: "t",
    state: "open",
    html_url: `https://github.com/a/one/issues/${partial.number}`,
    created_at: "2026-01-01T00:00:00Z",
    labels: [],
    ...partial,
  };
}

function pullRequest(partial: Partial<ApiPullRequest> & Pick<ApiPullRequest, "number">): ApiPullRequest {
  return {
    title: "t",
    state: "open",
    html_url: `https://github.com/a/one/pull/${partial.number}`,
    merged_at: null,
    body: "",
    labels: [],
    ...partial,
  };
}

function snapshotOf(issues: ApiIssue[], pullRequests: ApiPullRequest[] = []): RepoSnapshot {
  return { repo: "a/one", issues, pullRequests, labels: [], runs: [], issueTimelines: {} };
}

describe("building a flow result off a cached snapshot", () => {
  it("resolves each item's linked PR the same way a promotion body is read", () => {
    const snapshot = snapshotOf(
      [issue({ number: 161, labels: ["implement"] })],
      [pullRequest({ number: 200, body: "<!-- implement-issue: 161 -->", labels: ["review"] })],
    );

    const result = buildFlow(snapshot, { days: 30 }, new Date("2026-01-10T00:00:00Z"));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.stage).toBe("awaiting-review");
    expect(result.cfd.length).toBeGreaterThan(0);
  });

  it("never calls out to the forge -- it only ever reads the snapshot it is given", () => {
    const snapshot = snapshotOf([issue({ number: 1, state: "closed" })]);
    const result = buildFlow(snapshot, { all: true }, new Date("2026-01-10T00:00:00Z"));
    expect(result.items[0]?.stage).toBe("shipped");
  });

  it("carries the resolved period window as from/to (#165)", () => {
    const snapshot = snapshotOf([issue({ number: 1 })]);

    const byDays = buildFlow(snapshot, { days: 7 }, new Date("2026-01-10T00:00:00Z"));
    expect(byDays.to).toBe("2026-01-10T00:00:00.000Z");
    expect(byDays.from).toBe("2026-01-03T00:00:00.000Z");

    const all = buildFlow(snapshot, { all: true }, new Date("2026-01-10T00:00:00Z"));
    expect(all.from).toBe(new Date("2026-01-01T00:00:00Z").toISOString());
  });

  it("attaches each item's stage durations, summing to its own lead time", () => {
    const snapshot = snapshotOf([issue({ number: 1, created_at: "2026-01-01T00:00:00Z" })]);
    const now = new Date("2026-01-04T00:00:00Z");

    const result = buildFlow(snapshot, { days: 30 }, now);

    const total = Object.values(result.items[0]?.durationsMs ?? {}).reduce((sum, ms) => sum + ms, 0);
    expect(total).toBe(now.getTime() - new Date("2026-01-01T00:00:00Z").getTime());
  });
});
