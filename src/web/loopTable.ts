import { createElement, Fragment, type ReactNode } from "react";

import type { DataTableColumn } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/primitives";
import { styleFor } from "@/lib/statusStyles";

import { describe } from "../shared/outcome-line.js";
import type { LoopRun } from "../shared/types.js";
import { issueUrl } from "./pages/Log.js";

/**
 * The Loop page's recent-activity table, as a pure mapping from `LoopRun[]` to `DataTable`'s
 * own `rows`/`columns` contract (issue #148). Kept free of any rendering call so the mapping
 * tests the same way `src/server/runs.test.ts` tests `routeOf`/`subjectOf` -- by calling the
 * functions directly, never by mounting a component.
 */

/** `DataTable`'s row id: the loop's own run id, stable across refetches. */
export function loopTableRowId(run: LoopRun): string {
  return String(run.id);
}

/** The subject column's plain text -- a promotion's carried issues, comma-joined, or the
 *  run's own subject, the same fallback `App.tsx`'s list renders today. */
export function subjectTextOf(run: LoopRun): string {
  return run.carriedIssues === undefined
    ? run.subject
    : run.carriedIssues.map((issue) => `#${issue}`).join(", ");
}

function subjectCellOf(run: LoopRun): ReactNode {
  if (run.carriedIssues === undefined) return run.subject;
  return createElement(
    Fragment,
    null,
    run.carriedIssues.map((issue, index) =>
      createElement(
        Fragment,
        { key: issue },
        index > 0 ? ", " : "",
        createElement("a", { href: issueUrl(run.url, issue) }, `#${issue}`),
      ),
    ),
  );
}

/** Newest first -- the issue's default sort, as `DataTable`'s `initialSort` prop. */
export const loopTableInitialSort = { columnId: "startedAt", direction: "desc" } as const;

export const loopTableColumns: ReadonlyArray<DataTableColumn<LoopRun>> = [
  {
    id: "route",
    header: "Route",
    value: (run) => run.route,
    sortable: true,
    searchable: true,
  },
  {
    id: "outcome",
    header: "Outcome",
    // Sorts by the badge's own human label, not the enum's declaration order (the issue's
    // edge case) -- `styleFor` is the single source that label comes from.
    value: (run) => styleFor("loop", run.outcome).label,
    render: (run) => createElement(StatusBadge, { kind: "loop", state: run.outcome }),
    sortable: true,
  },
  {
    id: "outcomeLine",
    header: "Outcome line",
    value: (run) => describe(run),
    sortable: true,
    searchable: true,
  },
  {
    id: "subject",
    header: "Subject",
    value: subjectTextOf,
    render: subjectCellOf,
    sortable: true,
    searchable: true,
  },
  {
    id: "startedAt",
    header: "Started",
    value: (run) => run.startedAt,
    render: (run) => createElement("time", { dateTime: run.startedAt }, new Date(run.startedAt).toLocaleString()),
    sortable: true,
  },
  {
    id: "link",
    header: "Run",
    render: (run) => createElement("a", { href: run.url }, "View run"),
  },
];

/** The whole mapping in one call: a run list in, `DataTable`'s `rows`/`columns` out. */
export function loopTableOf(
  runs: readonly LoopRun[],
): { readonly rows: readonly LoopRun[]; readonly columns: ReadonlyArray<DataTableColumn<LoopRun>> } {
  return { rows: runs, columns: loopTableColumns };
}
