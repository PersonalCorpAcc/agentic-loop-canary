import { describe, expect, it } from "vitest";

import { BAR_SEGMENTS, READABLE_BAR_LIMIT, shippedInPeriod, timeInStageRows } from "./timeInStageBar.js";
import type { FlowItem, FlowStageName } from "../server/flow.js";

function zeroDurations(overrides: Partial<Record<FlowStageName, number>> = {}): Record<FlowStageName, number> {
  const base: Record<FlowStageName, number> = {
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
  return { ...base, ...overrides };
}

function item(partial: Partial<FlowItem> & Pick<FlowItem, "issue">): FlowItem {
  return {
    title: `Issue ${partial.issue}`,
    url: `https://github.com/acme/app/issues/${partial.issue}`,
    stage: "shipped",
    held: false,
    history: [{ stage: "shipped", enteredAt: "2026-01-05T00:00:00Z" }],
    durationsMs: zeroDurations(),
    ...partial,
  };
}

describe("filtering items to those shipped in a period", () => {
  it("keeps only shipped items whose last history entry falls in [from, to]", () => {
    const items = [
      item({ issue: 1, stage: "shipped", history: [{ stage: "shipped", enteredAt: "2026-01-05T00:00:00Z" }] }),
      item({ issue: 2, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-05T00:00:00Z" }] }),
      item({ issue: 3, stage: "shipped", history: [{ stage: "shipped", enteredAt: "2026-02-01T00:00:00Z" }] }),
    ];
    const kept = shippedInPeriod(items, "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z");
    expect(kept.map((row) => row.issue)).toEqual([1]);
  });
});

describe("building time-in-stage bar rows", () => {
  it("orders each row's segments specifying -> building -> validating -> awaiting-review -> deploying", () => {
    expect(BAR_SEGMENTS).toEqual(["specifying", "building", "validating", "awaiting-review", "deploying"]);

    const items = [
      item({
        issue: 1,
        durationsMs: zeroDurations({
          specifying: 1,
          building: 2,
          validating: 3,
          "awaiting-review": 4,
          deploying: 5,
        }),
      }),
    ];
    const result = timeInStageRows(items);
    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("expected individual mode");
    expect(result.rows[0]?.segments).toEqual([
      { stage: "specifying", ms: 1 },
      { stage: "building", ms: 2 },
      { stage: "validating", ms: 3 },
      { stage: "awaiting-review", ms: 4 },
      { stage: "deploying", ms: 5 },
    ]);
  });

  it("keeps a zero-duration sliver as an explicit 0, not dropped", () => {
    const items = [item({ issue: 1, durationsMs: zeroDurations({ specifying: 0, building: 10 }) })];
    const result = timeInStageRows(items);
    if (result.mode !== "individual") throw new Error("expected individual mode");
    expect(result.rows[0]?.segments).toContainEqual({ stage: "specifying", ms: 0 });
  });

  it("stays individual at exactly the limit, and switches to averaged just past it", () => {
    const atLimit = Array.from({ length: READABLE_BAR_LIMIT }, (_, index) => item({ issue: index + 1 }));
    expect(timeInStageRows(atLimit).mode).toBe("individual");

    const overLimit = Array.from({ length: READABLE_BAR_LIMIT + 1 }, (_, index) => item({ issue: index + 1 }));
    const result = timeInStageRows(overLimit);
    expect(result.mode).toBe("averaged");
    if (result.mode !== "averaged") throw new Error("expected averaged mode");
    expect(result.count).toBe(READABLE_BAR_LIMIT + 1);
  });

  it("averages each segment's duration across all items", () => {
    const items = [
      item({ issue: 1, durationsMs: zeroDurations({ building: 10 }) }),
      item({ issue: 2, durationsMs: zeroDurations({ building: 20 }) }),
      item({ issue: 3, durationsMs: zeroDurations({ building: 30 }) }),
    ];
    const result = timeInStageRows(items, 2);
    expect(result.mode).toBe("averaged");
    if (result.mode !== "averaged") throw new Error("expected averaged mode");
    expect(result.row.segments.find((segment) => segment.stage === "building")?.ms).toBe(20);
  });
});
