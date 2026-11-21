import { describe, expect, it } from "vitest";

import { ageInStageMs, flowTableColumns, flowTableInitialSort, flowTableRowId } from "./flowTable.js";
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
    reason: "",
    subject: "-",
    url: "https://github.com/acme/app/actions/runs/123",
    ...partial,
  };
}

describe("mapping flow items onto the DataTable contract", () => {
  it("has the fixed column set, title through last run", () => {
    const columns = flowTableColumns(new Date("2026-01-10T00:00:00Z"));
    expect(columns.map((column) => column.id)).toEqual([
      "title",
      "stage",
      "age",
      "estimate",
      "pr",
      "lastRun",
    ]);
  });

  it("sorts oldest-entered-stage first by default", () => {
    expect(flowTableInitialSort).toEqual({ columnId: "age", direction: "desc" });
  });

  it("gives every row a stable id from the issue number", () => {
    expect(flowTableRowId(item({ issue: 42, stage: "building" }))).toBe("42");
  });
});

describe("age in stage", () => {
  it("is the gap between now and the item's last history entry", () => {
    const theItem = item({
      issue: 1,
      stage: "building",
      history: [{ stage: "building", enteredAt: "2026-01-01T00:00:00Z" }],
    });
    expect(ageInStageMs(theItem, new Date("2026-01-02T00:00:00Z"))).toBe(86_400_000);
  });
});

describe("the title column", () => {
  const columns = flowTableColumns(new Date("2026-01-10T00:00:00Z"));
  const column = columns.find((c) => c.id === "title")!;

  it("is searchable and sortable on the issue title", () => {
    expect(column.searchable).toBe(true);
    expect(column.sortable).toBe(true);
    expect(column.value?.(item({ issue: 1, stage: "building", title: "fix the thing" }))).toBe(
      "fix the thing",
    );
  });
});

describe("the estimate column", () => {
  const columns = flowTableColumns(new Date("2026-01-10T00:00:00Z"));
  const column = columns.find((c) => c.id === "estimate")!;

  it("parses the sp-N estimate off the item's labels", () => {
    expect(column.value?.(item({ issue: 1, stage: "building", labels: ["sp-5"] }))).toBe(5);
  });

  it("is null, not omitted, when no label carries an estimate", () => {
    expect(column.value?.(item({ issue: 1, stage: "building", labels: [] }))).toBeNull();
  });
});

describe("the PR column", () => {
  const columns = flowTableColumns(new Date("2026-01-10T00:00:00Z"));
  const column = columns.find((c) => c.id === "pr")!;

  it("links to the linked pull request when one exists", () => {
    const cell = column.render?.(
      item({ issue: 1, stage: "awaiting-review", prUrl: "https://github.com/acme/app/pull/9" }),
    ) as { props: { href: string } };
    expect(cell.props.href).toBe("https://github.com/acme/app/pull/9");
  });

  it("shows an em dash rather than omitting the cell when there is no linked PR", () => {
    expect(column.render?.(item({ issue: 1, stage: "backlog" }))).toBe("—");
  });
});

describe("the last run column", () => {
  const columns = flowTableColumns(new Date("2026-01-10T00:00:00Z"));
  const column = columns.find((c) => c.id === "lastRun")!;

  it("describes the item's last run when it has one", () => {
    const theRun = run({ id: 1, route: "implement", subject: "#7", reason: "shipped", startedAt: "2026-01-01T00:00:00Z" });
    expect(column.value?.(item({ issue: 7, stage: "shipped", lastRun: theRun }))).toBe("implement #7: shipped");
  });

  it("shows an em dash rather than omitting the cell when there is no last run", () => {
    expect(column.value?.(item({ issue: 1, stage: "backlog" }))).toBeNull();
    expect(column.render?.(item({ issue: 1, stage: "backlog" }))).toBe("—");
  });
});
