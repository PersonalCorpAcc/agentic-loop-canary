import { describe, expect, it } from "vitest";

import { blockingLabelOf, promotionSnapshotMarker, remainingSoakSeconds } from "./stages.js";

describe("which label is stopping a promotion", () => {
  it("is undefined for an issue with none of the three", () => {
    expect(blockingLabelOf(["bug", "implement"])).toBeUndefined();
  });

  it("reads hold, rollback or hotfix off an issue's labels", () => {
    expect(blockingLabelOf(["hold"])).toBe("hold");
    expect(blockingLabelOf(["rollback"])).toBe("rollback");
    expect(blockingLabelOf(["hotfix"])).toBe("hotfix");
  });

  it("reports hold first when an issue somehow carries more than one", () => {
    expect(blockingLabelOf(["hotfix", "hold"])).toBe("hold");
    expect(blockingLabelOf(["rollback", "hotfix"])).toBe("rollback");
  });
});

describe("the promotion snapshot marker", () => {
  it("matches the grammar promote-change.sh stamps", () => {
    expect(promotionSnapshotMarker("test", "abc1234")).toBe("<!-- promotion-snapshot: test: abc1234 -->");
  });
});

describe("remaining soak time", () => {
  const mergedAt = "2026-11-20T00:00:00.000Z";
  const mergedEpoch = Date.parse(mergedAt);

  it("counts down from the full duration right after the merge", () => {
    expect(remainingSoakSeconds(300, mergedAt, mergedEpoch)).toBe(300);
  });

  it("subtracts elapsed time", () => {
    expect(remainingSoakSeconds(300, mergedAt, mergedEpoch + 120_000)).toBe(180);
  });

  it("floors an already-elapsed soak at zero rather than going negative", () => {
    expect(remainingSoakSeconds(300, mergedAt, mergedEpoch + 600_000)).toBe(0);
  });
});
