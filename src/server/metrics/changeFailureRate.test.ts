import { describe, expect, it } from "vitest";

import { changeFailureEntries, changeFailureRateBuckets, computeChangeFailureRate } from "./changeFailureRate.js";
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

describe("changeFailureRateBuckets", () => {
  it("buckets daily for a 30-day span and weekly for a 91-day span", () => {
    const timelines = [
      shipped(401, "2026-01-10T00:00:00Z"),
      shippedWithIncident(402, "2026-01-10T00:00:00Z", "rollback", "2026-01-11T00:00:00Z"),
    ];

    const daily = changeFailureRateBuckets(timelines, MERGED_MAIN, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"));
    expect(daily.granularity).toBe("day");
    expect(daily.buckets).toHaveLength(31);
    const bucket = daily.buckets.find((b) => b.date === "2026-01-10");
    expect(bucket).toEqual({ date: "2026-01-10", shipped: 2, failed: 1, rate: 0.5 });

    const weekly = changeFailureRateBuckets(timelines, MERGED_MAIN, new Date("2026-01-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z"));
    expect(weekly.granularity).toBe("week");
    expect(weekly.buckets[0]?.date).toBe("2025-12-29");
  });

  it("reports rate 0 with all-zero buckets still present when nothing shipped", () => {
    const result = changeFailureRateBuckets([], MERGED_MAIN, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-05T00:00:00Z"));
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets.every((b) => b.shipped === 0 && b.failed === 0 && b.rate === 0)).toBe(true);
  });
});

describe("changeFailureEntries", () => {
  const issues = [
    { number: 501, title: "Still-open hold", html_url: "https://example.test/issues/501" },
    { number: 502, title: "No pull request found", html_url: "https://example.test/issues/502" },
  ];

  it("includes an issue with an open (unclosed) incident, with closedAt/days undefined", () => {
    const timeline: IssueTimeline = {
      issue: 501,
      events: [
        { event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: MERGED_MAIN } },
        { event: "labeled", created_at: "2026-11-02T00:00:00Z", label: { name: "hold" } },
      ],
    };
    const entries = changeFailureEntries([501], issues, [timeline], []);
    expect(entries).toEqual([
      {
        issue: 501,
        title: "Still-open hold",
        url: "https://example.test/issues/501",
        pullRequest: undefined,
        label: "hold",
        openedAt: "2026-11-02T00:00:00Z",
        closedAt: undefined,
        days: undefined,
      },
    ]);
  });

  it("leaves pullRequest undefined when no pull request carries the implement-issue marker", () => {
    const timeline: IssueTimeline = {
      issue: 502,
      events: [
        { event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: MERGED_MAIN } },
        { event: "labeled", created_at: "2026-11-02T00:00:00Z", label: { name: "rollback" } },
        { event: "unlabeled", created_at: "2026-11-03T00:00:00Z", label: { name: "rollback" } },
      ],
    };
    const pullRequests = [{ number: 9, html_url: "https://example.test/pull/9", state: "closed", body: "no marker here" }];
    const entries = changeFailureEntries([502], issues, [timeline], pullRequests);
    expect(entries).toEqual([
      {
        issue: 502,
        title: "No pull request found",
        url: "https://example.test/issues/502",
        pullRequest: undefined,
        label: "rollback",
        openedAt: "2026-11-02T00:00:00Z",
        closedAt: "2026-11-03T00:00:00Z",
        days: 1,
      },
    ]);
  });

  it("joins the implementing pull request when its body carries the implement-issue marker, preferring an open one", () => {
    const timeline: IssueTimeline = {
      issue: 502,
      events: [
        { event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: MERGED_MAIN } },
        { event: "labeled", created_at: "2026-11-02T00:00:00Z", label: { name: "rollback" } },
        { event: "unlabeled", created_at: "2026-11-03T00:00:00Z", label: { name: "rollback" } },
      ],
    };
    const pullRequests = [
      { number: 8, html_url: "https://example.test/pull/8", state: "closed", body: "<!-- implement-issue: 502 -->" },
      { number: 10, html_url: "https://example.test/pull/10", state: "open", body: "<!-- implement-issue: 502 -->" },
    ];
    const entries = changeFailureEntries([502], issues, [timeline], pullRequests);
    expect(entries[0]?.pullRequest).toEqual({ number: 10, url: "https://example.test/pull/10" });
  });

  it("is empty when nothing failed", () => {
    expect(changeFailureEntries([], issues, [], [])).toEqual([]);
  });
});
