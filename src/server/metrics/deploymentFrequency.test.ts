import { describe, expect, it } from "vitest";

import { computeDeploymentFrequency } from "./deploymentFrequency.js";
import type { TimelineEvent } from "../metrics.js";

function issue(number: number, title = "t"): { number: number; title: string; html_url: string } {
  return { number, title, html_url: `https://github.com/a/one/issues/${number}` };
}

describe("computeDeploymentFrequency", () => {
  it("counts a batched promotion's three carried issues as three on the day they land", () => {
    const day = "2026-02-01T12:00:00Z";
    const timelines: Record<number, TimelineEvent[]> = {
      101: [{ event: "labeled", created_at: day, label: { name: "merged-main" } }],
      102: [{ event: "labeled", created_at: day, label: { name: "merged-main" } }],
      103: [{ event: "labeled", created_at: day, label: { name: "merged-main" } }],
    };

    const result = computeDeploymentFrequency(
      [issue(101), issue(102), issue(103)],
      timelines,
      new Date("2026-02-01T00:00:00Z"),
      new Date("2026-02-01T23:59:59Z"),
    );

    expect(result.total).toBe(3);
    expect(result.entries.map((entry) => entry.issue).sort()).toEqual([101, 102, 103]);
    const bucket = result.buckets.find((b) => b.date === "2026-02-01");
    expect(bucket?.count).toBe(3);
  });

  it("uses the first merged-main occurrence, not the latest, after a remove-and-re-add", () => {
    const firstMergedAt = "2026-01-01T00:00:00Z";
    const reAddedAt = "2026-01-05T00:00:00Z";
    const timelines: Record<number, TimelineEvent[]> = {
      5: [
        { event: "labeled", created_at: firstMergedAt, label: { name: "merged-main" } },
        { event: "unlabeled", created_at: "2026-01-02T00:00:00Z", label: { name: "merged-main" } },
        { event: "labeled", created_at: reAddedAt, label: { name: "merged-main" } },
      ],
    };

    const result = computeDeploymentFrequency(
      [issue(5)],
      timelines,
      new Date("2020-01-01T00:00:00Z"),
      new Date("2030-01-01T00:00:00Z"),
    );

    expect(result.entries[0]?.mergedAt).toBe(firstMergedAt);
    expect(result.entries[0]?.mergedAt).not.toBe(reAddedAt);
  });

  it("excludes an issue with no merged-main event at all", () => {
    const timelines: Record<number, TimelineEvent[]> = {
      6: [{ event: "labeled", created_at: "2026-01-01T00:00:00Z", label: { name: "implement" } }],
    };

    const result = computeDeploymentFrequency(
      [issue(6)],
      timelines,
      new Date("2020-01-01T00:00:00Z"),
      new Date("2030-01-01T00:00:00Z"),
    );

    expect(result.entries.find((entry) => entry.issue === 6)).toBeUndefined();
    expect(result.total).toBe(0);
  });

  it("filters out an otherwise-valid entry whose mergedAt falls outside [from, to]", () => {
    const insideMergedAt = "2026-03-10T00:00:00Z";
    const outsideMergedAt = "2026-05-01T00:00:00Z";
    const timelines: Record<number, TimelineEvent[]> = {
      30: [{ event: "labeled", created_at: insideMergedAt, label: { name: "merged-main" } }],
      31: [{ event: "labeled", created_at: outsideMergedAt, label: { name: "merged-main" } }],
    };

    const result = computeDeploymentFrequency(
      [issue(30), issue(31)],
      timelines,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-04-01T00:00:00Z"),
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.issue).toBe(30);
    expect(result.total).toBe(1);
  });

  it("buckets daily for a 30-day span and weekly for a 91-day span", () => {
    const timelines: Record<number, TimelineEvent[]> = {};

    const daily = computeDeploymentFrequency(
      [],
      timelines,
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-31T00:00:00Z"),
    );
    expect(daily.granularity).toBe("day");
    expect(daily.buckets).toHaveLength(31);
    expect(daily.buckets[0]?.date).toBe("2026-01-01");
    expect(daily.buckets.at(-1)?.date).toBe("2026-01-31");

    const weekly = computeDeploymentFrequency(
      [],
      timelines,
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-04-02T00:00:00Z"),
    );
    expect(weekly.granularity).toBe("week");
    // 2026-01-01 is a Thursday; its Monday-anchored week start is 2025-12-29.
    expect(weekly.buckets[0]?.date).toBe("2025-12-29");
  });

  it("reports total 0 with all-zero buckets still present when nothing merged", () => {
    const result = computeDeploymentFrequency(
      [issue(1)],
      { 1: [{ event: "labeled", created_at: "2020-01-01T00:00:00Z", label: { name: "implement" } }] },
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-05T00:00:00Z"),
    );

    expect(result.total).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets.every((b) => b.count === 0)).toBe(true);
    expect(result.granularity).toBe("day");
  });

  it("computes previousTotal from the preceding same-length window, independent of total", () => {
    const timelines: Record<number, TimelineEvent[]> = {
      40: [{ event: "labeled", created_at: "2026-01-10T00:00:00Z", label: { name: "merged-main" } }],
      41: [{ event: "labeled", created_at: "2026-01-20T00:00:00Z", label: { name: "merged-main" } }],
    };

    const result = computeDeploymentFrequency(
      [issue(40), issue(41)],
      timelines,
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-01-25T00:00:00Z"),
    );

    expect(result.total).toBe(1);
    expect(result.entries[0]?.issue).toBe(41);
    expect(result.previousTotal).toBe(1);
  });

  it("previousTotal is 0, not a special sentinel, when the preceding window had no merges", () => {
    const result = computeDeploymentFrequency(
      [issue(50)],
      { 50: [{ event: "labeled", created_at: "2026-01-20T00:00:00Z", label: { name: "merged-main" } }] },
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-01-25T00:00:00Z"),
    );

    expect(result.previousTotal).toBe(0);
    expect(result.total).toBe(1);
  });
});
