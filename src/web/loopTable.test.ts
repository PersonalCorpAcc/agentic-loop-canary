import { describe, expect, it } from "vitest";

import {
  loopTableColumns,
  loopTableInitialSort,
  loopTableOf,
  loopTableRowId,
  subjectTextOf,
} from "./loopTable.js";
import type { LoopRun } from "../shared/types.js";

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

describe("mapping runs onto the DataTable contract", () => {
  it("passes runs straight through as rows, and the fixed column set", () => {
    const runs = [run({ id: 1, startedAt: "2026-03-05T01:00:00Z" })];
    const table = loopTableOf(runs);
    expect(table.rows).toBe(runs);
    expect(table.columns).toBe(loopTableColumns);
    expect(table.columns.map((column) => column.id)).toEqual([
      "route",
      "outcome",
      "outcomeLine",
      "subject",
      "startedAt",
      "link",
    ]);
  });

  it("sorts newest first by default", () => {
    expect(loopTableInitialSort).toEqual({ columnId: "startedAt", direction: "desc" });
  });

  it("gives every row a stable id from the run's own id", () => {
    expect(loopTableRowId(run({ id: 42, startedAt: "2026-03-05T01:00:00Z" }))).toBe("42");
  });
});

describe("the outcome column", () => {
  const column = loopTableColumns.find((c) => c.id === "outcome")!;

  it("shows a StatusBadge for a handed-to-human run with its outcome line", () => {
    const theRun = run({
      id: 1,
      route: "merge-gate",
      outcome: "handed-to-human",
      reason: "review-requested",
      subject: "#25",
      startedAt: "2026-03-05T01:00:00Z",
    });
    expect(column.value?.(theRun)).toBe("Handed to human");
    const outcomeLineColumn = loopTableColumns.find((c) => c.id === "outcomeLine")!;
    expect(outcomeLineColumn.value?.(theRun)).toBe("merge-gate #25: review-requested");
  });

  it("sorts by the human label, not the enum's declaration order", () => {
    // Declaration order in `Outcome` is acted, no-action, handed-to-human, failed; the
    // labels sort differently (Acted, Failed, Handed to human, No action, Unknown).
    const outcomes: Array<LoopRun["outcome"]> = ["failed", "acted", "unknown", "handed-to-human", "no-action"];
    const labels = outcomes
      .map((outcome) => run({ id: 1, outcome, startedAt: "2026-03-05T01:00:00Z" }))
      .map((theRun) => column.value?.(theRun))
      .sort();
    expect(labels).toEqual(["Acted", "Failed", "Handed to human", "No action", "Unknown"]);
  });

  it("shows an unknown outcome rather than omitting the row", () => {
    expect(column.value?.(run({ id: 1, outcome: "unknown", startedAt: "2026-03-05T01:00:00Z" }))).toBe("Unknown");
  });
});

describe("the subject column", () => {
  it("renders a promotion's several carried issues, same as the old list", () => {
    expect(subjectTextOf(run({ id: 1, subject: "#40", carriedIssues: [47, 52], startedAt: "2026-03-05T01:00:00Z" })))
      .toBe("#47, #52");
  });

  it("falls back to the run's own subject with no carried issues", () => {
    expect(subjectTextOf(run({ id: 1, subject: "#25", startedAt: "2026-03-05T01:00:00Z" }))).toBe("#25");
  });
});
