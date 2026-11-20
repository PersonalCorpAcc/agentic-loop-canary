import { describe, expect, it } from "vitest";

import { computeChangeFailureRate } from "./changeFailureRate.js";
import type { IssueTimeline } from "./timeline.js";

/**
 * Fixtures are synthetic rather than drawn from this repository's own history: a search of
 * this repository's issues (open and closed) for the `hold` and `rollback` labels, run while
 * writing this test, returned none -- the canary has not yet had an incident to carry
 * either label. The event shape itself (`event: "labeled" | "unlabeled"`, a `label.name`)
 * matches the documented GitHub `/events` schema and the shape `deploymentFrequency.ts`
 * (#143) already reads it as.
 */
const MERGED_MAIN = "merged-main";

function shipped(issue: number, mergedAt: string): IssueTimeline {
  return { issue, events: [{ event: "labeled", created_at: mergedAt, label: { name: MERGED_MAIN } }] };
}

function shippedWithIncident(issue: number, mergedAt: string, incidentLabel: string, labelledAt: string): IssueTimeline {
  return {
    issue,
    events: [
      { event: "labeled", created_at: mergedAt, label: { name: MERGED_MAIN } },
      { event: "labeled", created_at: labelledAt, label: { name: incidentLabel } },
    ],
  };
}

const SINCE = new Date("2026-11-01T00:00:00Z");
const UNTIL = new Date("2026-11-30T23:59:59Z");

describe("computeChangeFailureRate", () => {
  it("counts a clean shipped change toward the denominator but not the numerator", () => {
    const result = computeChangeFailureRate([shipped(201, "2026-11-10T09:00:00Z")], MERGED_MAIN, SINCE, UNTIL);
    expect(result).toEqual({ shipped: 1, failed: [], rate: 0 });
  });

  it("counts a change rollback labelled -- the same signal promote-change.sh's revert detection stamps -- as a failure", () => {
    const result = computeChangeFailureRate(
      [shippedWithIncident(202, "2026-11-10T09:00:00Z", "rollback", "2026-11-12T14:00:00Z")],
      MERGED_MAIN,
      SINCE,
      UNTIL,
    );
    expect(result).toEqual({ shipped: 1, failed: [202], rate: 1 });
  });

  it("counts a hold-labelled change as a failure too", () => {
    const result = computeChangeFailureRate(
      [shippedWithIncident(203, "2026-11-10T09:00:00Z", "hold", "2026-11-11T08:00:00Z")],
      MERGED_MAIN,
      SINCE,
      UNTIL,
    );
    expect(result).toEqual({ shipped: 1, failed: [203], rate: 1 });
  });

  it("excludes an issue that ever carried hotfix from both the numerator and the denominator", () => {
    const hotfixed: IssueTimeline = {
      issue: 204,
      events: [
        { event: "labeled", created_at: "2026-11-10T09:00:00Z", label: { name: MERGED_MAIN } },
        { event: "labeled", created_at: "2026-11-10T09:05:00Z", label: { name: "hotfix" } },
        { event: "labeled", created_at: "2026-11-11T08:00:00Z", label: { name: "rollback" } },
      ],
    };
    const result = computeChangeFailureRate([hotfixed], MERGED_MAIN, SINCE, UNTIL);
    expect(result).toEqual({ shipped: 0, failed: [], rate: 0 });
  });

  it("excludes a change that merged outside the period", () => {
    const result = computeChangeFailureRate([shipped(205, "2026-10-15T09:00:00Z")], MERGED_MAIN, SINCE, UNTIL);
    expect(result).toEqual({ shipped: 0, failed: [], rate: 0 });
  });

  it("is a rate of 0 rather than NaN when nothing shipped in the period", () => {
    expect(computeChangeFailureRate([], MERGED_MAIN, SINCE, UNTIL).rate).toBe(0);
  });

  it("computes an exact fractional rate across several shipped changes", () => {
    const result = computeChangeFailureRate(
      [
        shipped(301, "2026-11-02T00:00:00Z"),
        shipped(302, "2026-11-03T00:00:00Z"),
        shippedWithIncident(303, "2026-11-04T00:00:00Z", "rollback", "2026-11-05T00:00:00Z"),
        shipped(304, "2026-11-06T00:00:00Z"),
      ],
      MERGED_MAIN,
      SINCE,
      UNTIL,
    );
    expect(result).toEqual({ shipped: 4, failed: [303], rate: 0.25 });
  });
});
