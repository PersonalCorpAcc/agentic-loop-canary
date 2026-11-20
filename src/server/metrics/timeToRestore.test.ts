import { describe, expect, it } from "vitest";

import { computeTimeToRestore } from "./timeToRestore.js";
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
