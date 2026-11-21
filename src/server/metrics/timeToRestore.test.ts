import { describe, expect, it } from "vitest";

import { computeTimeToRestore, timeToRestoreBuckets } from "./timeToRestore.js";
import type { IssueTimeline } from "./timeline.js";

/**
 * Fixtures are synthetic rather than drawn from this repository's own history, for the same
 * reason `changeFailureRate.test.ts` documents: no issue here has carried `hold` or
 * `rollback` yet. Durations are chosen as whole days so the assertions stay exact.
 */
const SINCE = new Date("2026-11-01T00:00:00Z");
const UNTIL = new Date("2026-11-30T23:59:59Z");

describe("computeTimeToRestore", () => {
  it("is T1 minus T0 in days, attributed to the day the label cleared", () => {
    const timeline: IssueTimeline = {
      issue: 401,
      events: [
        { event: "labeled", created_at: "2026-11-10T09:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-11-13T09:00:00Z", label: { name: "hold" } },
      ],
    };
    const result = computeTimeToRestore([timeline], SINCE, UNTIL);
    expect(result.samples).toEqual([
      { issue: 401, label: "hold", openedAt: "2026-11-10T09:00:00Z", closedAt: "2026-11-13T09:00:00Z", days: 3 },
    ]);
    expect(result.averageDays).toBe(3);
  });

  it("excludes a still-open incident with no removal event yet", () => {
    const timeline: IssueTimeline = {
      issue: 402,
      events: [{ event: "labeled", created_at: "2026-11-10T09:00:00Z", label: { name: "rollback" } }],
    };
    const result = computeTimeToRestore([timeline], SINCE, UNTIL);
    expect(result).toEqual({ samples: [], averageDays: 0 });
  });

  it("yields one sample per hold/release pair when a change was held, released, then held again", () => {
    const timeline: IssueTimeline = {
      issue: 403,
      events: [
        { event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-11-02T00:00:00Z", label: { name: "hold" } },
        { event: "labeled", created_at: "2026-11-05T00:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-11-08T00:00:00Z", label: { name: "hold" } },
      ],
    };
    const result = computeTimeToRestore([timeline], SINCE, UNTIL);
    expect(result.samples).toEqual([
      { issue: 403, label: "hold", openedAt: "2026-11-01T00:00:00Z", closedAt: "2026-11-02T00:00:00Z", days: 1 },
      { issue: 403, label: "hold", openedAt: "2026-11-05T00:00:00Z", closedAt: "2026-11-08T00:00:00Z", days: 3 },
    ]);
    expect(result.averageDays).toBe(2);
  });

  it("gives hold and rollback on the same issue each their own sample", () => {
    const timeline: IssueTimeline = {
      issue: 404,
      events: [
        { event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-11-02T00:00:00Z", label: { name: "hold" } },
        { event: "labeled", created_at: "2026-11-10T00:00:00Z", label: { name: "rollback" } },
        { event: "unlabeled", created_at: "2026-11-15T00:00:00Z", label: { name: "rollback" } },
      ],
    };
    const result = computeTimeToRestore([timeline], SINCE, UNTIL);
    expect(result.samples).toEqual([
      { issue: 404, label: "hold", openedAt: "2026-11-01T00:00:00Z", closedAt: "2026-11-02T00:00:00Z", days: 1 },
      { issue: 404, label: "rollback", openedAt: "2026-11-10T00:00:00Z", closedAt: "2026-11-15T00:00:00Z", days: 5 },
    ]);
  });

  it("excludes an issue that ever carried hotfix", () => {
    const timeline: IssueTimeline = {
      issue: 405,
      events: [
        { event: "labeled", created_at: "2026-11-01T00:00:00Z", label: { name: "hotfix" } },
        { event: "labeled", created_at: "2026-11-02T00:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-11-03T00:00:00Z", label: { name: "hold" } },
      ],
    };
    expect(computeTimeToRestore([timeline], SINCE, UNTIL)).toEqual({ samples: [], averageDays: 0 });
  });

  it("excludes a sample whose clearing event falls outside the period", () => {
    const timeline: IssueTimeline = {
      issue: 406,
      events: [
        { event: "labeled", created_at: "2026-10-20T00:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-10-25T00:00:00Z", label: { name: "hold" } },
      ],
    };
    expect(computeTimeToRestore([timeline], SINCE, UNTIL)).toEqual({ samples: [], averageDays: 0 });
  });
});

describe("timeToRestoreBuckets", () => {
  it("buckets daily for a 30-day span and weekly for a 91-day span, by the clearing date", () => {
    const timeline: IssueTimeline = {
      issue: 501,
      events: [
        { event: "labeled", created_at: "2026-01-08T00:00:00Z", label: { name: "hold" } },
        { event: "unlabeled", created_at: "2026-01-10T00:00:00Z", label: { name: "hold" } },
      ],
    };

    const daily = timeToRestoreBuckets([timeline], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"));
    expect(daily.granularity).toBe("day");
    expect(daily.buckets).toHaveLength(31);
    expect(daily.buckets.find((b) => b.date === "2026-01-10")).toEqual({ date: "2026-01-10", averageDays: 2, count: 1 });

    const weekly = timeToRestoreBuckets([timeline], new Date("2026-01-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z"));
    expect(weekly.granularity).toBe("week");
    expect(weekly.buckets[0]?.date).toBe("2025-12-29");
  });

  it("averages multiple samples that clear in the same bucket", () => {
    const timelines: IssueTimeline[] = [
      {
        issue: 502,
        events: [
          { event: "labeled", created_at: "2026-01-10T00:00:00Z", label: { name: "hold" } },
          { event: "unlabeled", created_at: "2026-01-11T00:00:00Z", label: { name: "hold" } },
        ],
      },
      {
        issue: 503,
        events: [
          { event: "labeled", created_at: "2026-01-07T00:00:00Z", label: { name: "rollback" } },
          { event: "unlabeled", created_at: "2026-01-11T00:00:00Z", label: { name: "rollback" } },
        ],
      },
    ];
    const result = timeToRestoreBuckets(timelines, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"));
    expect(result.buckets.find((b) => b.date === "2026-01-11")).toEqual({ date: "2026-01-11", averageDays: 2.5, count: 2 });
  });

  it("reports averageDays 0 with all-zero buckets still present when nothing cleared", () => {
    const result = timeToRestoreBuckets([], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-05T00:00:00Z"));
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets.every((b) => b.averageDays === 0 && b.count === 0)).toBe(true);
  });
});
