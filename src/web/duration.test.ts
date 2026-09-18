import { describe, expect, it } from "vitest";

import { durationLabel } from "./duration.js";

describe("describing how long a run took", () => {
  it("reports a run still going as running", () => {
    expect(durationLabel({ startedAt: "2026-09-16T09:00:00Z" })).toBe("running");
  });

  it("reports whole seconds under a minute", () => {
    expect(durationLabel({ startedAt: "2026-09-15T09:00:00Z", finishedAt: "2026-09-15T09:00:42Z" })).toBe("42s");
  });

  it("reports minutes and seconds once a run runs long", () => {
    expect(durationLabel({ startedAt: "2026-09-15T09:00:00Z", finishedAt: "2026-09-15T09:04:12Z" })).toBe("4m 12s");
  });
});
