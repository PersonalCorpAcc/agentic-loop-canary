import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import { PageHeader, Section } from "@/components/layout";
import { Sparkline } from "@/components/data-display";
import { DataTable } from "@/components/data-display/DataTable";
import { FlowStrip } from "@/components/domain";
import { StatTile } from "@/components/primitives";

import type { FlowItem, FlowResult, FlowStageName } from "../../server/flow.js";
import type { LeadTimeResult } from "../../server/metrics/leadTime.js";
import type { RepoRef } from "../../shared/repo.js";
import { flowStripCards, toggleStageFilter } from "../flowStrip.js";
import { flowTableColumns, flowTableInitialSort, flowTableRowId } from "../flowTable.js";
import { formatLeadTimeDays } from "../leadTime.js";

/** How often the flow strip + work item table refetch `/api/flow` once mounted -- the same
 *  poll the TV mode (#162) stays on, since nothing else on this page would otherwise notice a
 *  stage change between visits. */
const FLOW_POLL_MS = 30_000;

/** Root page (`/`). The lead-time stat tile + sparkline (#144), and the flow strip + work item
 *  table (#162): nine connected stage cards above a `DataTable` of every classified issue,
 *  click-to-filter between them. */
export function Overview(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const tv = searchParams.get("tv") === "1";
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [leadTime, setLeadTime] = useState<LeadTimeResult | null | undefined>(undefined);
  const [flow, setFlow] = useState<FlowResult | null | undefined>(undefined);
  const [flowFetching, setFlowFetching] = useState(false);
  const [selected, setSelected] = useState<FlowStageName | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const period = searchParams.get("period") ?? "";
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period });
    fetch(`/api/lead-time?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<LeadTimeResult>) : null))
      .then(setLeadTime)
      .catch(() => setLeadTime(null));
  }, [repo, searchParams]);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const period = searchParams.get("period") ?? "";
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period });

    let cancelled = false;
    const fetchFlow = (): void => {
      setFlowFetching(true);
      fetch(`/api/flow?${params.toString()}`)
        .then((response) => (response.ok ? (response.json() as Promise<FlowResult>) : null))
        .then((body) => {
          if (!cancelled) setFlow(body);
        })
        .catch(() => {
          if (!cancelled) setFlow(null);
        })
        .finally(() => {
          if (!cancelled) setFlowFetching(false);
        });
    };

    fetchFlow();
    const interval = setInterval(fetchFlow, FLOW_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [repo, searchParams]);

  const now = flow ? new Date(flow.to) : new Date();
  const cards = useMemo(() => flowStripCards(flow?.items ?? [], flow?.cfd ?? [], now), [flow, now]);
  const tableColumns = useMemo(() => flowTableColumns(now), [now]);
  const tableRows = useMemo(
    () =>
      selected === undefined
        ? flow?.items ?? []
        : (flow?.items ?? []).filter((item) => item.stage === selected),
    [flow, selected],
  );

  // Nothing has ever loaded yet -- the "first load" skeleton. Once the first request settles
  // (success or failure), later refetches dim the stale snapshot instead (DataTable's own
  // loading/fetching convention, #162's edge case).
  const flowLoading = flow === undefined;
  const flowDimmed = flowFetching && !flowLoading;

  const toggleTv = (): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tv) next.delete("tv");
      else next.set("tv", "1");
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <Button variant="outlined" size="small" onClick={toggleTv}>
            {tv ? "Exit TV mode" : "TV mode"}
          </Button>
        }
      />
      {leadTime ? (
        <Section title="Lead time">
          <StatTile
            label="Lead time"
            value={leadTime.medianDays === undefined ? "—" : formatLeadTimeDays(leadTime.medianDays)}
            sub={<Sparkline points={leadTime.dailyMedians.map((d) => d.medianDays)} />}
          />
        </Section>
      ) : null}
      <Stack spacing={4} sx={{ mt: 4 }}>
        <Section title="Flow">
          <FlowStrip
            cards={cards}
            selected={selected}
            onSelect={(stage) => setSelected((current) => toggleStageFilter(current, stage))}
            loading={flowLoading}
            fetching={flowDimmed}
          />
        </Section>
        <Section title="Work items">
          <DataTable<FlowItem>
            rows={tableRows}
            columns={tableColumns}
            getRowId={flowTableRowId}
            loading={flowLoading}
            fetching={flowDimmed}
            searchable
            searchPlaceholder="Search work items…"
            initialSort={flowTableInitialSort}
            emptyMessage={selected === undefined ? "No work items." : "No work items in this stage."}
          />
        </Section>
      </Stack>
    </>
  );
}
