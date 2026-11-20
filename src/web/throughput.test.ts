import { describe, expect, it } from "vitest";

import { throughputByDay } from "./throughput.js";
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

function shippedItem(issue: number, enteredAt: string): FlowItem {
  return {
    issue,
    title: `Issue ${issue}`,
    url: `https://github.com/acme/app/issues/${issue}`,
    stage: "shipped",
    held: false,
    history: [{ stage: "shipped", enteredAt }],
    durationsMs: zeroDurations(),
    createdAt: "2025-12-01T00:00:00Z",
  };
}

describe("throughputByDay", () => {
  it("counts zero for a day with no ships", () => {
    const days = throughputByDay([], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));
    expect(days).toEqual([
      { date: "2026-01-01", count: 0 },
      { date: "2026-01-02", count: 0 },
      { date: "2026-01-03", count: 0 },
    ]);
  });

  it("counts multiple ships on the same day", () => {
    const items = [
      shippedItem(1, "2026-01-02T05:00:00Z"),
      shippedItem(2, "2026-01-02T18:00:00Z"),
      shippedItem(3, "2026-01-03T00:00:00.000Z"),
    ];
    const days = throughputByDay(items, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));
    expect(days).toEqual([
      { date: "2026-01-01", count: 0 },
      { date: "2026-01-02", count: 2 },
      { date: "2026-01-03", count: 1 },
    ]);
  });

  it("excludes items that have not shipped", () => {
    const building: FlowItem = { ...shippedItem(1, "2026-01-02T00:00:00Z"), stage: "building" };
    const days = throughputByDay([building], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));
    expect(days.every((day) => day.count === 0)).toBe(true);
  });
});
