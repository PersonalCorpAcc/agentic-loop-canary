import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

import { DataTable } from "@/components/data-display/DataTable";
import { PageHeader } from "@/components/layout";
import { FlowStrip } from "@/components/domain";

import type { FlowResult, FlowStageName } from "../../server/flow.js";
import type { RepoRef } from "../../shared/repo.js";
import type { LoopRun } from "../../shared/types.js";
import { cardDataOf, toggleStageFilter } from "../flowStrip.js";
import { flowTableColumns, flowTableRowId, flowTableRows } from "../flowTable.js";

/** `/api/flow` is re-polled on this interval so TV mode (#162) keeps refreshing without a
 *  manual reload -- the same "a plain interval notices state nothing else triggers" reasoning
 *  `Log.tsx`'s stage poll already uses. */
const FLOW_POLL_MS = 30_000;

/** Root page (`/`): the flow strip's nine hero cards, plus the work item table they filter
 *  (#162). Both read off the same `/api/flow` snapshot the Delivery page's CFD also uses. */
export function Overview(): ReactElement {
  const [searchParams] = useSearchParams();
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  // Only ever set from a *successful* `/api/flow` fetch, so a failed refetch leaves the
  // previous snapshot in place rather than blanking the page (the issue's unreachable-API
  // edge case: skeleton before any snapshot has ever loaded, dimmed previous snapshot after).
  const [flow, setFlow] = useState<FlowResult | undefined>(undefined);
  const [fetching, setFetching] = useState(false);
  const [runs, setRuns] = useState<readonly LoopRun[]>([]);
  const [selectedStage, setSelectedStage] = useState<FlowStageName | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  useEffect(() => {
    fetch("/api/runs")
      .then((response) => response.json() as Promise<LoopRun[]>)
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const period = searchParams.get("period") ?? "";
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period });

    const fetchFlow = (): void => {
      setFetching(true);
      fetch(`/api/flow?${params.toString()}`)
        .then((response) => (response.ok ? (response.json() as Promise<FlowResult>) : null))
        .then((result) => {
          if (result !== null) setFlow(result);
        })
        .catch(() => undefined)
        .finally(() => setFetching(false));
    };

    fetchFlow();
    const interval = setInterval(fetchFlow, FLOW_POLL_MS);
    return () => clearInterval(interval);
  }, [repo, searchParams]);

  const now = useMemo(() => (flow ? new Date(flow.to) : new Date()), [flow]);
  const cards = useMemo(() => (flow ? cardDataOf(flow, now) : []), [flow, now]);
  const rows = useMemo(() => (flow ? flowTableRows(flow.items, runs, now) : []), [flow, runs, now]);
  const visibleRows = useMemo(
    () => (selectedStage === undefined ? rows : rows.filter((row) => row.item.stage === selectedStage)),
    [rows, selectedStage],
  );

  return (
    <Stack spacing={4} sx={{ height: "100%", minHeight: 0 }}>
      <PageHeader title="Overview" />
      <FlowStrip
        cards={cards}
        selected={selectedStage}
        onSelect={(stage) => setSelectedStage((current) => toggleStageFilter(current, stage))}
        loading={flow === undefined}
        fetching={fetching && flow !== undefined}
      />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <DataTable
          rows={visibleRows}
          columns={flowTableColumns}
          getRowId={flowTableRowId}
          loading={flow === undefined}
          fetching={fetching && flow !== undefined}
          searchable
          searchPlaceholder="Search work items…"
          initialSort={{ columnId: "age", direction: "desc" }}
        />
      </Box>
    </Stack>
  );
}
