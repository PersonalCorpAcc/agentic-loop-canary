import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";

import { PageHeader, Section } from "@/components/layout";
import { LeadTimeChart, ThroughputChart, TimeInStageBar, WaitingOnPersonList } from "@/components/domain";
import { TrendChart } from "@/components/data-display";
import { DataTable } from "@/components/data-display/DataTable";
import { ChartSkeleton, HelperText } from "@/components/primitives";

import type { FlowResult } from "../../server/flow.js";
import type { DeploymentFrequencyEntry, DeploymentFrequencyResult } from "../../server/metrics/deploymentFrequency.js";
import type { LeadTimeEntry, LeadTimeResult } from "../../server/metrics/leadTime.js";
import { parsePeriod, previousPeriodWindow } from "../../shared/period.js";
import type { RepoRef } from "../../shared/repo.js";
import { formatLeadTimeDays, leadTimeStats } from "../leadTime.js";
import { throughputByDay } from "../throughput.js";
import { shippedInPeriod, timeInStageRows } from "../timeInStageBar.js";
import { waitingRows } from "../waitingOnPerson.js";

/** `/delivery` page (#165): "where time goes" (a stacked bar per shipped item, or an averaged
 *  one), "who do I need to go ask" (the waiting-on-a-person list), "lead time" (#144, a
 *  trend chart + table of implement-to-merged-main durations), and "deployment frequency"
 *  (#143, a trend chart + table of changes merged to `main`), all built off the same cached
 *  `/api/flow`/`/api/lead-time`/`/api/deployment-frequency` snapshots the Overview page's
 *  CFD/stat tiles also read. */
export function Delivery(): ReactElement {
  const [searchParams] = useSearchParams();
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [flow, setFlow] = useState<FlowResult | null | undefined>(undefined);
  const [leadTime, setLeadTime] = useState<LeadTimeResult | null | undefined>(undefined);
  const [deploymentFrequency, setDeploymentFrequency] = useState<DeploymentFrequencyResult | null | undefined>(
    undefined,
  );

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

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const period = searchParams.get("period") ?? "";
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period });
    fetch(`/api/deployment-frequency?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<DeploymentFrequencyResult>) : null))
      .then(setDeploymentFrequency)
      .catch(() => setDeploymentFrequency(null));
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
          {(() => {
            const shipped = shippedInPeriod(flow.items, flow.from, flow.to);
            if (shipped.length === 0) {
              return (
                <>
                  <Section title="Throughput">
                    <ChartSkeleton />
                  </Section>
                  <Section title="Lead time trend (created → shipped)">
                    <ChartSkeleton />
                  </Section>
                </>
              );
            }

            const period = parsePeriod(searchParams.get("period"));
            const previousWindow = previousPeriodWindow(period, new Date(flow.to));
            const currentThroughput = throughputByDay(flow.items, new Date(flow.from), new Date(flow.to));
            const previousThroughput = throughputByDay(
              flow.items,
              new Date(previousWindow.from),
              new Date(previousWindow.to),
            );
            const currentLeadTime = leadTimeStats(flow.items, flow.from, flow.to);
            const previousLeadTime = leadTimeStats(flow.items, previousWindow.from, previousWindow.to);

            return (
              <>
                <Section title="Throughput">
                  <ThroughputChart current={currentThroughput} previous={previousThroughput} />
                </Section>
                <Section title="Lead time trend (created → shipped)">
                  <Stack spacing={1}>
                    <LeadTimeChart current={currentLeadTime} previous={previousLeadTime} />
                    {currentLeadTime.excludedCount > 0 ? (
                      <HelperText>
                        {currentLeadTime.excludedCount} shipped item{currentLeadTime.excludedCount === 1 ? "" : "s"}{" "}
                        excluded for unreliable creation lineage
                      </HelperText>
                    ) : null}
                  </Stack>
                </Section>
              </>
            );
          })()}
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
          {deploymentFrequency ? (
            <Section title="Deployment frequency">
              {deploymentFrequency.total === 0 ? (
                <HelperText>No changes merged in this period</HelperText>
              ) : (
                <Stack spacing={2}>
                  <TrendChart
                    points={deploymentFrequency.buckets.map((b) => ({ date: b.date, value: b.count }))}
                  />
                  <DataTable<DeploymentFrequencyEntry>
                    rows={deploymentFrequency.entries}
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
                    ]}
                  />
                </Stack>
              )}
            </Section>
          ) : null}
        </Stack>
      ) : null}
    </>
  );
}
