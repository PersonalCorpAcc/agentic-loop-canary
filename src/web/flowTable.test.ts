import { describe, expect, it } from "vitest";

import { estimateOf, flowTableColumns, flowTableRowId, flowTableRows, lastRunFor } from "./flowTable.js";
import type { FlowItem, FlowStageName } from "../server/flow.js";
import type { LoopRun } from "../shared/types.js";

function zeroDurations(): Record<FlowStageName, number> {
  return {
    backlog: 0,
    specifying: 0,
    "needs-answers": 0,
    ready: 0,
    building: 0,
    validating: 0,
    "awaiting-review": 0,
    deploying: 0,
    shipped: 0,
  };
}

function item(partial: Partial<FlowItem> & Pick<FlowItem, "issue" | "stage">): FlowItem {
  return {
    title: `Issue ${partial.issue}`,
    url: `https://github.com/acme/app/issues/${partial.issue}`,
    held: false,
    history: [{ stage: partial.stage, enteredAt: "2026-01-01T00:00:00Z" }],
    durationsMs: zeroDurations(),
    labels: [],
    ...partial,
  };
}

function run(partial: Partial<LoopRun> & Pick<LoopRun, "id" | "startedAt">): LoopRun {
  return {
    route: "implement",
    outcome: "acted",
    reason: "done",
    subject: "-",
    url: `https://github.com/acme/app/actions/runs/${partial.id}`,
    ...partial,
  };
}

describe("estimateOf", () => {
  it("parses the sp-N label", () => {
    expect(estimateOf(["implement", "sp-5"])).toBe(5);
  });

  it("is undefined when no sp- label is present", () => {
    expect(estimateOf(["implement", "refined"])).toBeUndefined();
  });

  it("is undefined for a malformed sp- label", () => {
    expect(estimateOf(["sp-big"])).toBeUndefined();
  });
});

describe("lastRunFor", () => {
  it("matches a run whose subject names the issue directly", () => {
    const runs = [
      run({ id: 1, startedAt: "2026-01-01T00:00:00Z", subject: "#161" }),
      run({ id: 2, startedAt: "2026-01-02T00:00:00Z", subject: "#999" }),
    ];
    expect(lastRunFor(161, runs)?.id).toBe(1);
  });

  it("matches a promotion run that carried the issue", () => {
    const runs = [run({ id: 1, startedAt: "2026-01-01T00:00:00Z", subject: "#200", carriedIssues: [161, 162] })];
    expect(lastRunFor(162, runs)?.id).toBe(1);
  });

  it("picks the most recently started match", () => {
    const runs = [
      run({ id: 1, startedAt: "2026-01-01T00:00:00Z", subject: "#161" }),
      run({ id: 2, startedAt: "2026-01-05T00:00:00Z", subject: "#161" }),
    ];
    expect(lastRunFor(161, runs)?.id).toBe(2);
  });

  it("is undefined when no run names the issue", () => {
    expect(lastRunFor(161, [run({ id: 1, startedAt: "2026-01-01T00:00:00Z", subject: "#999" })])).toBeUndefined();
  });
});

describe("flowTableColumns", () => {
  it("marks only age and estimate sortable, and title searchable", () => {
    const byId = Object.fromEntries(flowTableColumns.map((c) => [c.id, c]));
    expect(byId["age"]?.sortable).toBe(true);
    expect(byId["estimate"]?.sortable).toBe(true);
    expect(byId["title"]?.searchable).toBe(true);
    expect(byId["stage"]?.sortable).toBe(true);
    expect(byId["pr"]?.sortable).toBeUndefined();
    expect(byId["pr"]?.searchable).toBeUndefined();
  });
});

describe("flowTableRows", () => {
  it("builds one row per item, carrying estimate, PR link and last run", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const items = [item({ issue: 161, stage: "building", labels: ["sp-5"], prUrl: "https://github.com/a/one/pull/1" })];
    const runs = [run({ id: 1, startedAt: "2026-01-01T00:00:00Z", subject: "#161" })];

    const rows = flowTableRows(items, runs, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.estimate).toBe(5);
    expect(rows[0]?.prUrl).toBe("https://github.com/a/one/pull/1");
    expect(rows[0]?.lastRun?.id).toBe(1);
    expect(flowTableRowId(rows[0]!)).toBe("161");
  });

  it("leaves estimate/prUrl/lastRun undefined when absent", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const rows = flowTableRows([item({ issue: 1, stage: "backlog" })], [], now);
    expect(rows[0]?.estimate).toBeUndefined();
    expect(rows[0]?.prUrl).toBeUndefined();
    expect(rows[0]?.lastRun).toBeUndefined();
  });
});
