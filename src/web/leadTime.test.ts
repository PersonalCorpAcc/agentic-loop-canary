import { describe, expect, it } from "vitest";

import { leadTimeStats } from "./leadTime.js";
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

function shippedItem(issue: number, createdAt: string, shippedAt: string): FlowItem {
  return {
    issue,
    title: `Issue ${issue}`,
    url: `https://github.com/acme/app/issues/${issue}`,
    stage: "shipped",
    held: false,
    history: [{ stage: "shipped", enteredAt: shippedAt }],
    durationsMs: zeroDurations(),
    createdAt,
  };
}

describe("leadTimeStats", () => {
  it("computes median and p85 over a fixed set of shipped items", () => {
    const items = [
      shippedItem(1, "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"), // 24h
      shippedItem(2, "2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z"), // 48h
      shippedItem(3, "2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z"), // 72h
    ];
    const stats = leadTimeStats(items, "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z");
    expect(stats.sampleCount).toBe(3);
    expect(stats.median).toBe(48);
    expect(stats.excludedCount).toBe(0);
  });

  it("averages the two middle values for an even-length set", () => {
    const items = [
      shippedItem(1, "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"), // 24h
      shippedItem(2, "2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z"), // 48h
      shippedItem(3, "2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z"), // 72h
      shippedItem(4, "2026-01-01T00:00:00Z", "2026-01-05T00:00:00Z"), // 96h
    ];
    const stats = leadTimeStats(items, "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z");
    expect(stats.median).toBe(60);
  });

  it("computes on a set smaller than 5 items, no special-cased minimum", () => {
    const items = [shippedItem(1, "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")];
    const stats = leadTimeStats(items, "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z");
    expect(stats.sampleCount).toBe(1);
    expect(stats.median).toBe(24);
    expect(stats.p85).toBe(24);
  });

  it("excludes a shipped item with no reliable creation lineage, counting it instead", () => {
    const items = [
      shippedItem(1, "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"), // 24h, reliable
      shippedItem(2, "2026-01-05T00:00:00Z", "2026-01-01T00:00:00Z"), // shipped before created -- unreliable
    ];
    const stats = leadTimeStats(items, "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z");
    expect(stats.sampleCount).toBe(1);
    expect(stats.excludedCount).toBe(1);
    expect(stats.median).toBe(24);
  });
});
