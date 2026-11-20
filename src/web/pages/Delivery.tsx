import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";

import { PageHeader, Section } from "@/components/layout";
import { TimeInStageBar, WaitingOnPersonList } from "@/components/domain";
import { TrendChart } from "@/components/data-display";
import { DataTable } from "@/components/data-display/DataTable";

import type { FlowResult } from "../../server/flow.js";
import type { LeadTimeEntry, LeadTimeResult } from "../../server/metrics/leadTime.js";
import type { RepoRef } from "../../shared/repo.js";
import { formatLeadTimeDays } from "../leadTime.js";
import { shippedInPeriod, timeInStageRows } from "../timeInStageBar.js";
import { waitingRows } from "../waitingOnPerson.js";

/** `/delivery` page (#165): "where time goes" (a stacked bar per shipped item, or an averaged
 *  one), "who do I need to go ask" (the waiting-on-a-person list), and "lead time" (#144, a
 *  trend chart + table of implement-to-merged-main durations), all built off the same cached
 *  `/api/flow`/`/api/lead-time` snapshots the Overview page's CFD/stat tile also read. */
export function Delivery(): ReactElement {
  const [searchParams] = useSearchParams();
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [flow, setFlow] = useState<FlowResult | null | undefined>(undefined);
  const [leadTime, setLeadTime] = useState<LeadTimeResult | null | undefined>(undefined);

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
    fetch(`/api/flow?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<FlowResult>) : null))
      .then(setFlow)
      .catch(() => setFlow(null));
  }, [repo, searchParams]);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const period = searchParams.get("period") ?? "";
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period });
    fetch(`/api/lead-time?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<LeadTimeResult>) : null))
      .then(setLeadTime)
      .catch(() => setLeadTime(null));
  }, [repo, searchParams]);

  return (
    <>
      <PageHeader title="Delivery" />
      {flow ? (
        <Stack spacing={4}>
          <Section title="Where time goes">
            <TimeInStageBar result={timeInStageRows(shippedInPeriod(flow.items, flow.from, flow.to))} />
          </Section>
          <Section title="Waiting on a person">
            <WaitingOnPersonList rows={waitingRows(flow.items, new Date(flow.to))} />
          </Section>
          {leadTime ? (
            <Section title="Lead time">
              <Stack spacing={2}>
                <TrendChart
                  points={leadTime.dailyMedians.map((d) => ({ date: d.date, value: d.medianDays }))}
                  valueLabel={formatLeadTimeDays}
                />
                <DataTable<LeadTimeEntry>
                  rows={leadTime.entries}
                  getRowId={(entry) => String(entry.issue)}
                  columns={[
                    {
                      id: "issue",
                      header: "Issue",
                      render: (entry) => (
                        <a href={entry.url}>
                          #{entry.issue} {entry.title}
                        </a>
                      ),
                    },
                    {
                      id: "mergedAt",
                      header: "Merged",
                      value: (entry) => entry.mergedAt,
                      render: (entry) => entry.mergedAt.slice(0, 10),
                    },
                    {
                      id: "days",
                      header: "Lead time",
                      value: (entry) => entry.days,
                      render: (entry) => formatLeadTimeDays(entry.days),
                    },
                  ]}
                />
              </Stack>
            </Section>
          ) : null}
        </Stack>
      ) : null}
    </>
  );
}
