import { describe, expect, it } from "vitest";

import { carriesHotfix, everCarriedIncidentLabel, timelinesOf, type IssueTimeline } from "./timeline.js";

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

describe("timelinesOf", () => {
  it("joins each issue to its timeline, defaulting to an empty one when absent from the record", () => {
    const result = timelinesOf([{ number: 1 }, { number: 2 }], {
      1: [{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hold" } }],
    });
    expect(result).toEqual([
      { issue: 1, events: [{ event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hold" } }] },
      { issue: 2, events: [] },
    ]);
  });

  it("drops an event with no created_at rather than carrying it through un-dateable", () => {
    const result = timelinesOf([{ number: 1 }], {
      1: [
        { event: "labeled", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-11-02T00:00:00Z", label: { name: "hold" } },
      ],
    });
    expect(result).toEqual([{ issue: 1, events: [{ event: "unlabeled", created_at: "2026-11-02T00:00:00Z", label: { name: "hold" } }] }]);
  });
});
