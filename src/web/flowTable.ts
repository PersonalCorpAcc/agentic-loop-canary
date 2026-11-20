import { createElement } from "react";
import type { ReactNode } from "react";

import type { DataTableColumn } from "@/components/data-display/DataTable";
import { humanizeAge } from "@/components/domain";
import { StatusBadge } from "@/components/primitives";
import { styleFor } from "@/lib/statusStyles";

import type { FlowItem } from "../server/flow.js";
import { describe } from "../shared/outcome-line.js";
import type { LoopRun } from "../shared/types.js";
import { ageInCurrentStageMs } from "./flowStrip.js";

/**
 * The Overview page's work item table, as a pure mapping from `FlowItem[]` (plus the loop's
 * own run list) to `DataTable`'s `rows`/`columns` contract (#162). Kept free of any rendering
 * call, the same convention `loopTable.ts` uses.
 */

/** The `N` out of an `sp-N` label, or `undefined` when no such label is present or it does not
 *  parse to a number. */
export function estimateOf(labels: readonly string[]): number | undefined {
  for (const label of labels) {
    const match = /^sp-(\d+)$/.exec(label);
    if (match !== null) return Number(match[1]);
  }
  return undefined;
}

/** The most recently started run naming `issueNumber`, either as its own `#N` subject or as
 *  one of a promotion's `carriedIssues` -- the same two shapes `runs.ts` already produces.
 *  `undefined` when no run names this issue at all. */
export function lastRunFor(issueNumber: number, runs: readonly LoopRun[]): LoopRun | undefined {
  const matching = runs.filter(
    (run) => run.subject === `#${issueNumber}` || (run.carriedIssues?.includes(issueNumber) ?? false),
  );
  return [...matching].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

export interface FlowTableRow {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly item: FlowItem;
  readonly ageMs: number;
  readonly estimate: number | undefined;
  readonly prUrl: string | undefined;
  readonly lastRun: LoopRun | undefined;
}

/** `DataTable`'s row id: the issue number, stable across refetches. */
export function flowTableRowId(row: FlowTableRow): string {
  return String(row.issue);
}

/** One row per flow item, carrying everything the table's columns read. */
export function flowTableRows(items: readonly FlowItem[], runs: readonly LoopRun[], now: Date): FlowTableRow[] {
  return items.map((item) => ({
    issue: item.issue,
    title: item.title,
    url: item.url,
    item,
    ageMs: ageInCurrentStageMs(item, now),
    estimate: estimateOf(item.labels),
    prUrl: item.prUrl,
    lastRun: lastRunFor(item.issue, runs),
  }));
}

function titleCellOf(row: FlowTableRow): ReactNode {
  return createElement("a", { href: row.url }, `#${row.issue} ${row.title}`);
}

export const flowTableColumns: ReadonlyArray<DataTableColumn<FlowTableRow>> = [
  {
    id: "title",
    header: "Title",
    value: (row) => `#${row.issue} ${row.title}`,
    render: titleCellOf,
    searchable: true,
  },
  {
    id: "stage",
    header: "Stage",
    value: (row) => styleFor("flow", row.item.stage).label,
    render: (row) => createElement(StatusBadge, { kind: "flow", state: row.item.stage }),
    sortable: true,
  },
  {
    id: "age",
    header: "Age in stage",
    value: (row) => row.ageMs,
    render: (row) => humanizeAge(row.ageMs),
    sortable: true,
  },
  {
    id: "estimate",
    header: "Estimate",
    value: (row) => row.estimate ?? null,
    render: (row) => (row.estimate === undefined ? "—" : `${row.estimate} sp`),
    sortable: true,
    align: "right",
  },
  {
    id: "pr",
    header: "PR",
    render: (row) => (row.prUrl === undefined ? "—" : createElement("a", { href: row.prUrl }, "View PR")),
  },
  {
    id: "lastRun",
    header: "Last run",
    value: (row) => (row.lastRun ? describe(row.lastRun) : null),
    render: (row) =>
      row.lastRun
        ? createElement(
            "span",
            null,
            createElement(StatusBadge, { kind: "loop", state: row.lastRun.outcome }),
            " ",
            describe(row.lastRun),
          )
        : "—",
  },
];
