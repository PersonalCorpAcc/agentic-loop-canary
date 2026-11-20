import { describe, expect, it } from "vitest";

import {
  bucketKeyFor,
  compareToPreviousPeriod,
  computeDeploymentFrequency,
  granularityFor,
  mergedLabelFor,
  stageArrivalOf,
  type IssueTimeline,
} from "./deploymentFrequency.js";

/**
 * A fixture built from this repository's own history (AGENTS.md: "Fixtures come from real
 * runs of this loop rather than from invented data"), not a recorded `/events` response --
 * the GitHub MCP server this task ran under exposes no raw timeline-events read, and an
 * unauthenticated direct call hit GitHub's anonymous rate limit. What is real here: the
 * five issue numbers, and every `created_at` timestamp, which are each issue's own
 * `closed_at`/`updated_at` from the forge (read via the GitHub issue-read tool on
 * 2026-11-20) -- the same moment `work-router.yml` stamps `merged-main` and, under this
 * repo's `closeIssueOn: main`, closes the issue. Four of the five (#47, #96, #97, #107) carry
 * real timestamps sixteen seconds apart on 2026-09-22, which is what a single batched
 * `env-promotion` snapshot landing on `main` looks like. The surrounding event shape
 * (`event: "labeled"`, a single label-carrying event per issue) is reconstructed to match
 * the documented `/events` schema, not fetched.
 */
const MERGED_MAIN = "merged-main";

function labeledAt(issue: number, createdAt: string): IssueTimeline {
  return {
    issue,
    events: [
      { event: "renamed", created_at: createdAt },
      { event: "labeled", created_at: createdAt, label: { name: MERGED_MAIN } },
    ],
  };
}

const ISSUE_8 = labeledAt(8, "2026-09-17T20:06:44Z");
const ISSUE_47 = labeledAt(47, "2026-09-22T10:25:31Z");
const ISSUE_96 = labeledAt(96, "2026-09-22T10:25:45Z");
const ISSUE_97 = labeledAt(97, "2026-09-22T10:25:46Z");
const ISSUE_107 = labeledAt(107, "2026-09-22T10:25:47Z");

const TIMELINES = [ISSUE_8, ISSUE_47, ISSUE_96, ISSUE_97, ISSUE_107];

describe("mergedLabelFor", () => {
  it("names the label after the final stage in the chain", () => {
    expect(mergedLabelFor(["dev", "test", "main"])).toBe("merged-main");
  });

  it("is undefined for an empty chain", () => {
    expect(mergedLabelFor([])).toBeUndefined();
  });
});

describe("stageArrivalOf", () => {
  it("reads the labeled event's timestamp off the timeline", () => {
    expect(stageArrivalOf(ISSUE_8, MERGED_MAIN)).toBe("2026-09-17T20:06:44Z");
  });

  it("is undefined when the label never landed", () => {
    expect(stageArrivalOf(ISSUE_8, "merged-test")).toBeUndefined();
  });
});

describe("granularityFor", () => {
  it("is daily for 7 and 30 day periods", () => {
    expect(granularityFor(7)).toBe("day");
    expect(granularityFor(30)).toBe("day");
  });

  it("is weekly for a 90 day period", () => {
    expect(granularityFor(90)).toBe("week");
  });
});

describe("bucketKeyFor", () => {
  it("buckets by the UTC calendar day", () => {
    expect(bucketKeyFor("2026-09-22T23:59:59Z", "day")).toBe("2026-09-22");
    expect(bucketKeyFor("2026-09-22T00:00:00Z", "day")).toBe("2026-09-22");
  });

  it("buckets a week to its UTC Monday", () => {
    // 2026-09-22 is a Tuesday; its week starts Monday 2026-09-21.
    expect(bucketKeyFor("2026-09-22T10:25:45Z", "week")).toBe("2026-09-21");
    expect(bucketKeyFor("2026-09-21T00:00:00Z", "week")).toBe("2026-09-21");
    expect(bucketKeyFor("2026-09-27T23:59:59Z", "week")).toBe("2026-09-21");
  });
});

describe("computeDeploymentFrequency", () => {
  it("counts every issue in a batched promotion on the day it landed, not once per promotion", () => {
    const buckets = computeDeploymentFrequency(
      TIMELINES,
      MERGED_MAIN,
      new Date("2026-09-22T00:00:00Z"),
      new Date("2026-09-22T23:59:59Z"),
      "day",
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toEqual({
      bucket: "2026-09-22",
      count: 4,
      issues: [47, 96, 97, 107],
    });
  });

  it("zero-fills a quiet day rather than omitting it", () => {
    const buckets = computeDeploymentFrequency(
      TIMELINES,
      MERGED_MAIN,
      new Date("2026-09-18T00:00:00Z"),
      new Date("2026-09-20T23:59:59Z"),
      "day",
    );

    expect(buckets.map((bucket) => bucket.bucket)).toEqual(["2026-09-18", "2026-09-19", "2026-09-20"]);
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("spans the full period across both arrivals, bucketed by day", () => {
    const buckets = computeDeploymentFrequency(
      TIMELINES,
      MERGED_MAIN,
      new Date("2026-09-17T00:00:00Z"),
      new Date("2026-09-22T23:59:59Z"),
      "day",
    );

    expect(buckets).toHaveLength(6);
    expect(buckets[0]).toEqual({ bucket: "2026-09-17", count: 1, issues: [8] });
    expect(buckets.at(-1)).toEqual({ bucket: "2026-09-22", count: 4, issues: [47, 96, 97, 107] });
    expect(buckets.slice(1, 5).every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("buckets weekly for a longer period so a 90-day chart never renders one bar per day", () => {
    const buckets = computeDeploymentFrequency(
      TIMELINES,
      MERGED_MAIN,
      new Date("2026-09-14T00:00:00Z"),
      new Date("2026-09-27T23:59:59Z"),
      "week",
    );

    expect(buckets).toEqual([
      { bucket: "2026-09-14", count: 1, issues: [8] },
      { bucket: "2026-09-21", count: 4, issues: [47, 96, 97, 107] },
    ]);
  });

  it("excludes arrivals outside the requested period", () => {
    const buckets = computeDeploymentFrequency(
      TIMELINES,
      MERGED_MAIN,
      new Date("2026-09-22T00:00:00Z"),
      new Date("2026-09-22T23:59:59Z"),
      "day",
    );

    expect(buckets.flatMap((bucket) => bucket.issues)).not.toContain(8);
  });
});

describe("compareToPreviousPeriod", () => {
  it("reports an absolute and percentage delta against a non-zero previous period", () => {
    expect(compareToPreviousPeriod(4, 2)).toEqual({ kind: "comparison", delta: 2, percent: 100 });
  });

  it("reports no prior data rather than dividing by zero", () => {
    expect(compareToPreviousPeriod(3, 0)).toEqual({ kind: "no-prior-data" });
  });
});
