import { createElement, Fragment, type ReactNode } from "react";

import type { DataTableColumn } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/primitives";
import { FLOW_STYLES } from "@/lib/statusStyles";

import type { FlowItem } from "../server/flow.js";
import { describe } from "../shared/outcome-line.js";
import { estimateOf } from "./flowStrip.js";
import { stageEnteredAt } from "./waitingOnPerson.js";

/**
 * The Overview page's work item table (#162), as a pure mapping from `FlowItem[]` to
 * `DataTable`'s own `rows`/`columns` contract -- the same convention `loopTable.ts` uses so
 * this is unit-testable by calling the column functions directly, never by mounting a
 * component.
 */

export function flowTableRowId(item: FlowItem): string {
  return String(item.issue);
}

/** Milliseconds since `item` entered its current stage. */
export function ageInStageMs(item: FlowItem, now: Date): number {
  return now.getTime() - new Date(stageEnteredAt(item)).getTime();
}

function humanizeAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function lastRunCellOf(item: FlowItem): ReactNode {
  if (item.lastRun === undefined) return "—";
  return createElement(
    Fragment,
    null,
    createElement(StatusBadge, { kind: "loop", state: item.lastRun.outcome }),
    " ",
    describe(item.lastRun),
  );
}

/** Newest-entered-stage first -- the same "what needs attention first" bias the flow strip's
 *  stuck indicator uses. */
export const flowTableInitialSort = { columnId: "age", direction: "desc" } as const;

/** `now` drives the "age in stage" column, so this is a function of it rather than a plain
 *  constant (`loopTable.ts`'s columns need no such clock). */
export function flowTableColumns(now: Date): ReadonlyArray<DataTableColumn<FlowItem>> {
  return [
    {
      id: "title",
      header: "Title",
      value: (item) => item.title,
      render: (item) => createElement("a", { href: item.url }, `#${item.issue} ${item.title}`),
      sortable: true,
      searchable: true,
    },
    {
      id: "stage",
      header: "Stage",
      value: (item) => FLOW_STYLES[item.stage].label,
      render: (item) => createElement(StatusBadge, { kind: "flow", state: item.stage }),
      sortable: true,
    },
    {
      id: "age",
      header: "Age in stage",
      value: (item) => ageInStageMs(item, now),
      render: (item) => humanizeAge(ageInStageMs(item, now)),
      sortable: true,
    },
    {
      id: "estimate",
      header: "Estimate",
      value: (item) => estimateOf(item.labels) ?? null,
      render: (item) => {
        const estimate = estimateOf(item.labels);
        return estimate === undefined ? "—" : `${estimate} sp`;
      },
      sortable: true,
    },
    {
      id: "pr",
      header: "PR",
      render: (item) => (item.prUrl === undefined ? "—" : createElement("a", { href: item.prUrl }, "View PR")),
    },
    {
      id: "lastRun",
      header: "Last run",
      value: (item) => (item.lastRun === undefined ? null : describe(item.lastRun)),
      render: lastRunCellOf,
    },
  ];
}
