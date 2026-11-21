import { describe, expect, it } from "vitest";

import { STUCK_THRESHOLD_HOURS, waitingRows } from "./waitingOnPerson.js";
import type { FlowItem, FlowStageName } from "../server/flow.js";

function zeroDurations(): Record<FlowStageName, number> {
  return {
    backlog: 0,
    specifying: 0,
    "needs-answers": 0,
    ready: 0,
    building: 0,
    validating: 0,
    "awaiting-review": 0,
    deploying: 0,
    shipped: 0,
  };
}

function item(partial: Partial<FlowItem> & Pick<FlowItem, "issue" | "stage">): FlowItem {
  return {
    title: `Issue ${partial.issue}`,
    url: `https://github.com/acme/app/issues/${partial.issue}`,
    held: false,
    history: [],
    durationsMs: zeroDurations(),
    createdAt: "2025-12-01T00:00:00Z",
    ...partial,
  };
}

describe("building the waiting-on-a-person list", () => {
  it("only includes items currently in needs-answers or awaiting-review", () => {
    const items = [
      item({ issue: 1, stage: "needs-answers", history: [{ stage: "needs-answers", enteredAt: "2026-01-01T00:00:00Z" }] }),
      item({ issue: 2, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-01T00:00:00Z" }] }),
      item({
        issue: 3,
        stage: "awaiting-review",
        history: [{ stage: "awaiting-review", enteredAt: "2026-01-01T00:00:00Z" }],
      }),
    ];
    const rows = waitingRows(items, new Date("2026-01-02T00:00:00Z"));
    expect(rows.map((row) => row.issue)).toEqual([1, 3]);
  });

  it("sorts oldest-entered-stage first", () => {
    const items = [
      item({ issue: 1, stage: "needs-answers", history: [{ stage: "needs-answers", enteredAt: "2026-01-03T00:00:00Z" }] }),
      item({ issue: 2, stage: "needs-answers", history: [{ stage: "needs-answers", enteredAt: "2026-01-01T00:00:00Z" }] }),
      item({ issue: 3, stage: "needs-answers", history: [{ stage: "needs-answers", enteredAt: "2026-01-02T00:00:00Z" }] }),
    ];
    const rows = waitingRows(items, new Date("2026-01-10T00:00:00Z"));
    expect(rows.map((row) => row.issue)).toEqual([2, 3, 1]);
  });

  it("flips stuck exactly at the threshold", () => {
    const enteredAt = "2026-01-01T00:00:00Z";
    const items = [item({ issue: 1, stage: "needs-answers", history: [{ stage: "needs-answers", enteredAt }] })];

    const atThreshold = new Date(new Date(enteredAt).getTime() + STUCK_THRESHOLD_HOURS * 3_600_000);
    expect(waitingRows(items, atThreshold)[0]?.stuck).toBe(false);

    const pastThreshold = new Date(atThreshold.getTime() + 1);
    expect(waitingRows(items, pastThreshold)[0]?.stuck).toBe(true);
  });

  it("leaves questionText undefined, the no-comment-fetching scope decision", () => {
    const items = [
      item({ issue: 1, stage: "needs-answers", history: [{ stage: "needs-answers", enteredAt: "2026-01-01T00:00:00Z" }] }),
    ];
    expect(waitingRows(items, new Date("2026-01-02T00:00:00Z"))[0]?.questionText).toBeUndefined();
  });
});
