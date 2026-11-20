import { describe, expect, it } from "vitest";

import { computeLeadTime } from "./leadTime.js";
import type { TimelineEvent } from "../metrics.js";

function issue(number: number, title = "t"): { number: number; title: string; html_url: string } {
  return { number, title, html_url: `https://github.com/a/one/issues/${number}` };
}

const ALL_TIME = { from: new Date("2020-01-01T00:00:00Z"), to: new Date("2030-01-01T00:00:00Z") };

describe("computeLeadTime", () => {
  it("is the gap between implement and merged-main for a straightforward issue", () => {
    const t0 = "2026-01-01T00:00:00Z";
    const t1 = "2026-01-04T12:00:00Z";
    const timelines: Record<number, TimelineEvent[]> = {
      1: [
        { event: "labeled", created_at: t0, label: { name: "implement" } },
        { event: "labeled", created_at: t1, label: { name: "merged-main" } },
      ],
    };

    const result = computeLeadTime([issue(1)], timelines, ALL_TIME.from, ALL_TIME.to);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.days).toBe((new Date(t1).getTime() - new Date(t0).getTime()) / 86_400_000);
    expect(result.entries[0]?.mergedAt).toBe(t1);
  });

  it("uses the latest implement labelling, not the first, after a remove-and-re-add", () => {
    const firstImplementAt = "2026-01-01T00:00:00Z";
    const reAddedAt = "2026-01-05T00:00:00Z";
    const mergedAt = "2026-01-06T00:00:00Z";
    const timelines: Record<number, TimelineEvent[]> = {
      2: [
        { event: "labeled", created_at: firstImplementAt, label: { name: "implement" } },
        { event: "unlabeled", created_at: "2026-01-02T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: reAddedAt, label: { name: "implement" } },
        { event: "labeled", created_at: mergedAt, label: { name: "merged-main" } },
      ],
    };

    const result = computeLeadTime([issue(2)], timelines, ALL_TIME.from, ALL_TIME.to);

    const expectedWrongDays =
      (new Date(mergedAt).getTime() - new Date(firstImplementAt).getTime()) / 86_400_000;
    const expectedRightDays = (new Date(mergedAt).getTime() - new Date(reAddedAt).getTime()) / 86_400_000;

    expect(result.entries[0]?.days).toBe(expectedRightDays);
    expect(result.entries[0]?.days).not.toBe(expectedWrongDays);
    expect(result.entries[0]?.days).toBe(1);
  });

  it("excludes an issue carrying implement with no merged-main event at all", () => {
    const timelines: Record<number, TimelineEvent[]> = {
      3: [{ event: "labeled", created_at: "2026-01-01T00:00:00Z", label: { name: "implement" } }],
    };

    const result = computeLeadTime([issue(3)], timelines, ALL_TIME.from, ALL_TIME.to);

    expect(result.entries.find((entry) => entry.issue === 3)).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("excludes an issue whose merged-main lands with no preceding implement labelling", () => {
    const timelines: Record<number, TimelineEvent[]> = {
      4: [{ event: "labeled", created_at: "2026-01-01T00:00:00Z", label: { name: "merged-main" } }],
    };

    const result = computeLeadTime([issue(4)], timelines, ALL_TIME.from, ALL_TIME.to);

    expect(result.entries.find((entry) => entry.issue === 4)).toBeUndefined();
  });

  it("buckets a day's dailyMedians by median, not mean, distinguishing the two", () => {
    // Three issues merging on the same UTC day with days = 1, 2, 9: mean is 4, median is 2.
    const day = "2026-02-01";
    const timelines: Record<number, TimelineEvent[]> = {
      10: [
        { event: "labeled", created_at: "2026-01-31T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: `${day}T00:00:00Z`, label: { name: "merged-main" } },
      ],
      11: [
        { event: "labeled", created_at: "2026-01-30T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: `${day}T00:00:00Z`, label: { name: "merged-main" } },
      ],
      12: [
        { event: "labeled", created_at: "2026-01-23T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: `${day}T00:00:00Z`, label: { name: "merged-main" } },
      ],
    };

    const result = computeLeadTime([issue(10), issue(11), issue(12)], timelines, ALL_TIME.from, ALL_TIME.to);

    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => entry.days).sort((a, b) => a - b)).toEqual([1, 2, 9]);
    expect(result.dailyMedians).toHaveLength(1);
    expect(result.dailyMedians[0]?.date).toBe(day);
    expect(result.dailyMedians[0]?.medianDays).toBe(2);
    expect(result.dailyMedians[0]?.medianDays).not.toBe((1 + 2 + 9) / 3);
    expect(result.medianDays).toBe(2);
  });

  it("medianDays is undefined when no issue in the period has a computable lead time", () => {
    const emptyResult = computeLeadTime([], {}, ALL_TIME.from, ALL_TIME.to);
    expect(emptyResult.entries).toHaveLength(0);
    expect(emptyResult.medianDays).toBeUndefined();

    const timelines: Record<number, TimelineEvent[]> = {
      20: [
        { event: "labeled", created_at: "2026-01-01T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: "2026-01-02T00:00:00Z", label: { name: "merged-main" } },
      ],
    };
    const excludedByWindow = computeLeadTime(
      [issue(20)],
      timelines,
      new Date("2027-01-01T00:00:00Z"),
      new Date("2027-02-01T00:00:00Z"),
    );
    expect(excludedByWindow.entries).toHaveLength(0);
    expect(excludedByWindow.medianDays).toBeUndefined();
  });

  it("filters out an otherwise-valid entry whose mergedAt falls outside [from, to]", () => {
    const insideMergedAt = "2026-03-10T00:00:00Z";
    const outsideMergedAt = "2026-05-01T00:00:00Z";
    const timelines: Record<number, TimelineEvent[]> = {
      30: [
        { event: "labeled", created_at: "2026-03-01T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: insideMergedAt, label: { name: "merged-main" } },
      ],
      31: [
        { event: "labeled", created_at: "2026-04-01T00:00:00Z", label: { name: "implement" } },
        { event: "labeled", created_at: outsideMergedAt, label: { name: "merged-main" } },
      ],
    };

    const result = computeLeadTime(
      [issue(30), issue(31)],
      timelines,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-04-01T00:00:00Z"),
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.issue).toBe(30);
    expect(result.entries.find((entry) => entry.issue === 31)).toBeUndefined();
    expect(result.dailyMedians).toHaveLength(1);
    expect(result.dailyMedians[0]?.date).toBe("2026-03-10");
    expect(result.medianDays).toBe(result.entries[0]?.days);
  });
});
