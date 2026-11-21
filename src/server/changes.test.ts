import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  buildChanges,
  changeThresholdsOf,
  classifyChangeState,
  labelEnteredAt,
  linkedOpenPrOf,
} from "./changes.js";
import type { ApiIssue, ApiPullRequest, RepoSnapshot, TimelineEvent } from "./metrics.js";

const STAGES = ["dev", "test", "main"];

describe("classifying a change's board state off its own labels", () => {
  it("is implementing for an implement label with none of the others", () => {
    expect(classifyChangeState(["implement", "sp-3"], STAGES)).toEqual({ kind: "implementing" });
  });

  it("is in-review for the review label", () => {
    expect(classifyChangeState(["implement", "review"], STAGES)).toEqual({ kind: "in-review" });
  });

  it("is on a stage for merged-<stage> with no merged-<next> yet", () => {
    expect(classifyChangeState(["implement", "merged-dev"], STAGES)).toEqual({ kind: "stage", stage: "dev" });
    expect(classifyChangeState(["implement", "merged-dev", "merged-test"], STAGES)).toEqual({
      kind: "stage",
      stage: "test",
    });
  });

  it("gives the last stage no column of its own", () => {
    expect(classifyChangeState(["merged-dev", "merged-test", "merged-main"], STAGES)).toBeUndefined();
  });

  it("is held for hold, rollback or hotfix, ahead of review or a stage", () => {
    expect(classifyChangeState(["hold", "review"], STAGES)).toEqual({ kind: "held" });
    expect(classifyChangeState(["merged-dev", "rollback"], STAGES)).toEqual({ kind: "held" });
    expect(classifyChangeState(["implement", "hotfix"], STAGES)).toEqual({ kind: "held" });
  });

  it("shows a change stuck on a stage and later held as held, not on its stage", () => {
    expect(classifyChangeState(["merged-dev", "hold"], STAGES)).toEqual({ kind: "held" });
  });

  it("is undefined for a change still in triage or refine", () => {
    expect(classifyChangeState(["refine"], STAGES)).toBeUndefined();
    expect(classifyChangeState([], STAGES)).toBeUndefined();
  });
});

describe("the stuck thresholds", () => {
  it("defaults to 24/24/48/4 hours when every env var is unset", () => {
    expect(changeThresholdsOf({})).toEqual(DEFAULT_THRESHOLDS);
  });

  it("applies a configured override", () => {
    expect(changeThresholdsOf({ CHANGES_STUCK_HELD_HOURS: "2" }).held).toBe(2);
  });

  it("falls back to the default for 0 or a non-numeric value, rather than flagging everything", () => {
    expect(changeThresholdsOf({ CHANGES_STUCK_HELD_HOURS: "0" }).held).toBe(DEFAULT_THRESHOLDS.held);
    expect(changeThresholdsOf({ CHANGES_STUCK_IMPLEMENTING_HOURS: "nope" }).implementing).toBe(
      DEFAULT_THRESHOLDS.implementing,
    );
    expect(changeThresholdsOf({ CHANGES_STUCK_STAGE_HOURS: "-5" }).stage).toBe(DEFAULT_THRESHOLDS.stage);
  });
});

describe("reading when a change entered its current state", () => {
  it("picks the most recent matching labeled event", () => {
    const events: TimelineEvent[] = [
      { event: "labeled", created_at: "2026-01-01T00:00:00Z", label: { name: "hold" } },
      { event: "unlabeled", created_at: "2026-01-02T00:00:00Z", label: { name: "hold" } },
      { event: "labeled", created_at: "2026-01-03T00:00:00Z", label: { name: "hold" } },
      { event: "labeled", created_at: "2026-01-01T12:00:00Z", label: { name: "review" } },
    ];
    expect(labelEnteredAt(events, "hold", "1999-01-01T00:00:00Z")).toBe("2026-01-03T00:00:00Z");
  });

  it("falls back when the timeline carries no matching labeled event", () => {
    expect(labelEnteredAt([], "hold", "2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00:00Z");
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

function snapshotOf(
  issues: ApiIssue[],
  pullRequests: ApiPullRequest[] = [],
  issueTimelines: Record<number, readonly TimelineEvent[]> = {},
): RepoSnapshot {
  return { repo: "a/one", issues, pullRequests, labels: [], runs: [], issueTimelines };
}

describe("linking a change to its open pull request", () => {
  it("picks the forge's own first linkage when more than one pull request is open on it", () => {
    const one = issue({ number: 5 });
    const prs = [
      pullRequest({ number: 10, body: "<!-- implement-issue: 5 -->" }),
      pullRequest({ number: 11, body: "<!-- implement-issue: 5 -->" }),
    ];
    expect(linkedOpenPrOf(one, prs)).toEqual({ number: 10, url: "https://github.com/a/one/pull/10" });
  });

  it("is undefined when nothing open is linked", () => {
    expect(linkedOpenPrOf(issue({ number: 5 }), [])).toBeUndefined();
  });
});

describe("building the board", () => {
  const now = new Date("2026-01-10T00:00:00Z");

  it("shows one column per state in order, with the last stage never getting one", () => {
    const board = buildChanges(snapshotOf([]), STAGES, DEFAULT_THRESHOLDS, now);
    expect(board.columns.map((column) => column.label)).toEqual(["Implementing", "In review", "Dev", "Test", "Held"]);
  });

  it("gives an empty column an empty cards list, not an absent one", () => {
    const board = buildChanges(snapshotOf([]), STAGES, DEFAULT_THRESHOLDS, now);
    const testColumn = board.columns.find((column) => column.key === "stage:test");
    expect(testColumn?.cards).toEqual([]);
  });

  it("names a card's issue, its open pull request, and flags it stuck past the column threshold", () => {
    const snapshot = snapshotOf(
      [issue({ number: 7, title: "Thing", labels: ["implement"], created_at: "2026-01-01T00:00:00Z" })],
      [pullRequest({ number: 20, body: "<!-- implement-issue: 7 -->" })],
      { 7: [{ event: "labeled", created_at: "2026-01-08T18:00:00Z", label: { name: "implement" } }] },
    );

    const board = buildChanges(snapshot, STAGES, DEFAULT_THRESHOLDS, now);
    const card = board.columns.find((column) => column.key === "implementing")?.cards[0];

    expect(card?.issue).toBe(7);
    expect(card?.title).toBe("Thing");
    expect(card?.pullRequest).toEqual({ number: 20, url: "https://github.com/a/one/pull/20" });
    expect(card?.ageMs).toBe(now.getTime() - new Date("2026-01-08T18:00:00Z").getTime());
    expect(card?.stuck).toBe(true);
  });

  it("excludes a closed issue, and one with none of the deciding labels", () => {
    const snapshot = snapshotOf([
      issue({ number: 1, state: "closed", labels: ["implement"] }),
      issue({ number: 2, labels: ["refine"] }),
    ]);
    const board = buildChanges(snapshot, STAGES, DEFAULT_THRESHOLDS, now);
    expect(board.columns.flatMap((column) => column.cards)).toEqual([]);
  });

  it("collects every stuck card across columns into the needs-a-person list", () => {
    const snapshot = snapshotOf(
      [
        issue({ number: 1, labels: ["hold"] }),
        issue({ number: 2, labels: ["review"] }),
      ],
      [],
      {
        1: [{ event: "labeled", created_at: "2026-01-09T00:00:00Z", label: { name: "hold" } }],
        2: [{ event: "labeled", created_at: "2026-01-08T00:00:00Z", label: { name: "review" } }],
      },
    );

    const board = buildChanges(snapshot, STAGES, DEFAULT_THRESHOLDS, now);

    expect(board.stuck.map((card) => card.issue)).toEqual([2, 1]);
  });
});
