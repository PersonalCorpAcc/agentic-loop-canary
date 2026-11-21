import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";

import { PageHeader, Section } from "@/components/layout";
import { TrendChart } from "@/components/data-display";

import type { LoopTrendsResult } from "../../server/metrics/loopTrends.js";
import type { RepoRef } from "../../shared/repo.js";
import {
  formatDurationMs,
  formatPercent,
  medianDurationByRouteSeriesOf,
  outcomeMixSeriesOf,
  runsByRouteSeriesOf,
  shareNeedingAttentionSeriesOf,
  successRateSeriesOf,
} from "../loopTrends.js";

/** `/loop` page (#149): five day-by-day trend panels -- runs per route, outcome mix, success
 *  rate, median duration per route, and the share of runs needing a person -- scoped to the
 *  watched repository and the top bar's period, all read from the one `/api/loop-trends`
 *  snapshot so a panel's figures can never drift from a plain recount of that day's runs. */
export function Loop(): ReactElement {
  const [searchParams] = useSearchParams();
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [trends, setTrends] = useState<LoopTrendsResult | null | undefined>(undefined);

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
    fetch(`/api/loop-trends?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<LoopTrendsResult>) : null))
      .then(setTrends)
      .catch(() => setTrends(null));
  }, [repo, searchParams]);

  if (!trends) {
    return <PageHeader title="Loop" />;
  }

  const { points } = trends;

  return (
    <>
      <PageHeader title="Loop" />
      <Stack spacing={4}>
        <Section title="Runs per route">
          <TrendChart series={runsByRouteSeriesOf(points)} />
        </Section>
        <Section title="Outcome mix">
          <TrendChart series={outcomeMixSeriesOf(points)} />
        </Section>
        <Section title="Success rate">
          <TrendChart points={successRateSeriesOf(points)} valueLabel={formatPercent} />
        </Section>
        <Section title="Median duration by route">
          <TrendChart series={medianDurationByRouteSeriesOf(points)} valueLabel={formatDurationMs} />
        </Section>
        <Section title="Share needing a person">
          <TrendChart points={shareNeedingAttentionSeriesOf(points)} valueLabel={formatPercent} />
        </Section>
      </Stack>
    </>
  );
}
