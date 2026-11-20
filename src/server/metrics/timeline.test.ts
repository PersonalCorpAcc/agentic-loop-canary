import { describe, expect, it } from "vitest";

import { carriesHotfix, everCarriedIncidentLabel, type IssueTimeline } from "./timeline.js";

function timeline(events: IssueTimeline["events"]): IssueTimeline {
  return { issue: 1, events };
}

describe("carriesHotfix", () => {
  it("is true once the label has ever landed", () => {
    expect(carriesHotfix(timeline([{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hotfix" } }]))).toBe(
      true,
    );
  });

  it("is false when the issue never carried it", () => {
    expect(carriesHotfix(timeline([{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "rollback" } }]))).toBe(
      false,
    );
  });
});

describe("everCarriedIncidentLabel", () => {
  it("is true for hold", () => {
    expect(everCarriedIncidentLabel(timeline([{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hold" } }]))).toBe(
      true,
    );
  });

  it("is true for rollback", () => {
    expect(
      everCarriedIncidentLabel(timeline([{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "rollback" } }])),
    ).toBe(true);
  });

  it("is false for a clean timeline", () => {
    expect(
      everCarriedIncidentLabel(timeline([{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "merged-main" } }])),
    ).toBe(false);
  });

  it("is false for an empty timeline", () => {
    expect(everCarriedIncidentLabel(timeline([]))).toBe(false);
  });
});
