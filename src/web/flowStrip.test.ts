import { describe, expect, it } from "vitest";

import { estimateOf, flowStripCards, median, toggleStageFilter } from "./flowStrip.js";
import { STUCK_THRESHOLD_HOURS } from "./waitingOnPerson.js";
import type { CfdBucket, FlowItem, FlowStageName } from "../server/flow.js";

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

function zeroCounts(): Record<FlowStageName, number> {
  return { ...zeroDurations() };
}

function item(
  partial: Partial<FlowItem> & Pick<FlowItem, "issue" | "stage"> & { readonly enteredAt?: string },
): FlowItem {
  const { enteredAt, ...rest } = partial;
  return {
    title: `Issue ${partial.issue}`,
    url: `https://github.com/acme/app/issues/${partial.issue}`,
    held: false,
    history: [{ stage: partial.stage, enteredAt: enteredAt ?? "2026-01-01T00:00:00Z" }],
    durationsMs: zeroDurations(),
    labels: [],
    ...rest,
  };
}

describe("median", () => {
  it("is the middle value of an odd-length series", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middle values of an even-length series", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("is 0 for an empty series", () => {
    expect(median([])).toBe(0);
  });

  it("computes the expected median off a fixed set of enteredAt timestamps", () => {
    const now = new Date("2026-01-04T00:00:00Z");
    const enteredAts = ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z", "2026-01-03T12:00:00Z"];
    const ages = enteredAts.map((at) => now.getTime() - new Date(at).getTime());
    // Sorted ascending: 12h, 2d, 3d -- the middle is the 2-day gap.
    expect(median(ages)).toBe(2 * 86_400_000);
  });
});

describe("estimateOf", () => {
  it("parses the sp-N estimate off an issue's labels", () => {
    expect(estimateOf(["implement", "sp-5"])).toBe(5);
  });

  it("is undefined when no label matches", () => {
    expect(estimateOf(["implement", "review"])).toBeUndefined();
  });
});

describe("flowStripCards", () => {
  function cfdOf(counts: Partial<Record<FlowStageName, number>>): CfdBucket {
    return { date: "2026-01-01", counts: { ...zeroCounts(), ...counts } };
  }

  it("includes every stage, left to right, even one with zero items", () => {
    const cards = flowStripCards([], [], new Date("2026-01-10T00:00:00Z"));
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
    expect(cards.every((card) => card.count === 0)).toBe(true);
  });

  it("counts items per stage and carries the stage's own cfd series", () => {
    const items = [
      item({ issue: 1, stage: "building" }),
      item({ issue: 2, stage: "building" }),
      item({ issue: 3, stage: "backlog" }),
    ];
    const cfd = [cfdOf({ building: 1 }), cfdOf({ building: 2 })];

    const cards = flowStripCards(items, cfd, new Date("2026-01-10T00:00:00Z"));

    const building = cards.find((card) => card.stage === "building")!;
    expect(building.count).toBe(2);
    expect(building.sparkline).toEqual([1, 2]);
  });

  it("flags a stage stuck once its median age passes the threshold, not before", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const justUnder = new Date(now.getTime() - (STUCK_THRESHOLD_HOURS - 1) * 3_600_000).toISOString();
    const over = new Date(now.getTime() - (STUCK_THRESHOLD_HOURS + 1) * 3_600_000).toISOString();

    const notStuck = flowStripCards(
      [item({ issue: 1, stage: "needs-answers", enteredAt: justUnder })],
      [],
      now,
    );
    expect(notStuck.find((card) => card.stage === "needs-answers")?.stuck).toBe(false);

    const stuck = flowStripCards([item({ issue: 1, stage: "needs-answers", enteredAt: over })], [], now);
    expect(stuck.find((card) => card.stage === "needs-answers")?.stuck).toBe(true);
  });

  it("counts held items separately from the base count", () => {
    const items = [
      item({ issue: 1, stage: "building", held: true }),
      item({ issue: 2, stage: "building", held: false }),
    ];
    const cards = flowStripCards(items, [], new Date("2026-01-10T00:00:00Z"));
    const building = cards.find((card) => card.stage === "building")!;
    expect(building.count).toBe(2);
    expect(building.heldCount).toBe(1);
  });
});

describe("toggleStageFilter", () => {
  it("selects a stage when none is selected", () => {
    expect(toggleStageFilter(undefined, "building")).toBe("building");
  });

  it("narrows to the newly clicked stage when a different one is selected", () => {
    expect(toggleStageFilter("backlog", "building")).toBe("building");
  });

  it("clears the filter when the same stage is clicked again", () => {
    expect(toggleStageFilter("building", "building")).toBeUndefined();
  });
});
