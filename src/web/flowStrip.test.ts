import { describe, expect, it } from "vitest";

import {
  CARD_STUCK_THRESHOLD_HOURS,
  ageInCurrentStageMs,
  cardDataOf,
  median,
  toggleStageFilter,
} from "./flowStrip.js";
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

function item(partial: Partial<FlowItem> & Pick<FlowItem, "issue" | "stage" | "history">): FlowItem {
  return {
    title: `Issue ${partial.issue}`,
    url: `https://github.com/acme/app/issues/${partial.issue}`,
    held: false,
    durationsMs: zeroDurations(),
    labels: [],
    ...partial,
  };
}

describe("median", () => {
  it("is 0 for an empty set", () => {
    expect(median([])).toBe(0);
  });

  it("is the middle value for an odd-length set", () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length set", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  // The issue's own test requirement: a fixed set of enteredAt timestamps -> expected median.
  it("matches a fixed set of enteredAt-derived ages", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const items = [
      item({ issue: 1, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-01T00:00:00Z" }] }),
      item({ issue: 2, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-05T00:00:00Z" }] }),
      item({ issue: 3, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-09T00:00:00Z" }] }),
    ];
    const ages = items.map((i) => ageInCurrentStageMs(i, now));
    // 9 days, 5 days, 1 day -- median is the 5-day age.
    expect(median(ages)).toBe(5 * 86_400_000);
  });
});

describe("ageInCurrentStageMs", () => {
  it("is 0 for an item with no history entries", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(ageInCurrentStageMs(item({ issue: 1, stage: "backlog", history: [] }), now)).toBe(0);
  });

  it("is the gap from the last history entry to now", () => {
    const now = new Date("2026-01-03T00:00:00Z");
    const result = ageInCurrentStageMs(
      item({ issue: 1, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-01T00:00:00Z" }] }),
      now,
    );
    expect(result).toBe(2 * 86_400_000);
  });
});

describe("cardDataOf", () => {
  it("renders every stage, including those with zero items", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const cards = cardDataOf({ items: [], cfd: [] }, now);
    expect(cards).toHaveLength(9);
    expect(cards.every((card) => card.count === 0)).toBe(true);
    expect(cards.map((card) => card.stage)).toEqual([
      "backlog",
      "specifying",
      "needs-answers",
      "ready",
      "building",
      "validating",
      "awaiting-review",
      "deploying",
      "shipped",
    ]);
  });

  it("counts items per stage and flags held", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const items = [
      item({ issue: 1, stage: "building", history: [{ stage: "building", enteredAt: "2026-01-01T00:00:00Z" }] }),
      item({
        issue: 2,
        stage: "building",
        history: [{ stage: "building", enteredAt: "2026-01-02T00:00:00Z" }],
        held: true,
      }),
      item({ issue: 3, stage: "shipped", history: [{ stage: "shipped", enteredAt: "2026-01-09T00:00:00Z" }] }),
    ];
    const cards = cardDataOf({ items, cfd: [] }, now);
    const building = cards.find((c) => c.stage === "building");
    expect(building?.count).toBe(2);
    expect(building?.heldCount).toBe(1);
    const shipped = cards.find((c) => c.stage === "shipped");
    expect(shipped?.count).toBe(1);
    expect(shipped?.heldCount).toBe(0);
  });

  it("flags a card stuck once its median age exceeds the threshold", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const thresholdMs = CARD_STUCK_THRESHOLD_HOURS * 3_600_000;
    const stuckEnteredAt = new Date(now.getTime() - thresholdMs - 3_600_000).toISOString();
    const freshEnteredAt = new Date(now.getTime() - 3_600_000).toISOString();

    const stuckCards = cardDataOf(
      { items: [item({ issue: 1, stage: "building", history: [{ stage: "building", enteredAt: stuckEnteredAt }] })], cfd: [] },
      now,
    );
    expect(stuckCards.find((c) => c.stage === "building")?.stuck).toBe(true);

    const freshCards = cardDataOf(
      { items: [item({ issue: 1, stage: "building", history: [{ stage: "building", enteredAt: freshEnteredAt }] })], cfd: [] },
      now,
    );
    expect(freshCards.find((c) => c.stage === "building")?.stuck).toBe(false);
  });

  it("reads each stage's sparkline straight off the cfd series", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const zero = { backlog: 0, specifying: 0, "needs-answers": 0, ready: 0, building: 0, validating: 0, "awaiting-review": 0, deploying: 0, shipped: 0 };
    const cfd = [
      { date: "2026-01-08", counts: { ...zero, building: 2 } },
      { date: "2026-01-09", counts: { ...zero, building: 3 } },
    ];
    const cards = cardDataOf({ items: [], cfd }, now);
    expect(cards.find((c) => c.stage === "building")?.sparkline).toEqual([2, 3]);
  });
});

describe("toggleStageFilter", () => {
  it("selects an unselected stage", () => {
    expect(toggleStageFilter(undefined, "building")).toBe("building");
  });

  it("switches to a differently clicked stage", () => {
    expect(toggleStageFilter("building", "shipped")).toBe("shipped");
  });

  it("clears the filter when the selected stage is clicked again", () => {
    expect(toggleStageFilter("building", "building")).toBeUndefined();
  });
});
