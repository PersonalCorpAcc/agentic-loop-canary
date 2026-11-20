/**
 * ThroughputChart — the Delivery page's throughput trend (#164): a `@mui/x-charts` bar chart,
 * one bar per day in the selected period, the count of items whose `shipped` entry falls that
 * day. The immediately preceding period of equal length plots alongside it, aligned by day
 * offset rather than calendar date so the two periods compare directly, in a muted tone with
 * a legend distinguishing "this period" from "previous period".
 */
import { BarChart } from "@mui/x-charts/BarChart";
import { useTheme, type Theme } from "@mui/material/styles";
import type { JSX } from "react";

import { useStatusTone } from "@/components/primitives";

import type { ThroughputDay } from "../../web/throughput.js";

export interface ThroughputChartProps {
  readonly current: readonly ThroughputDay[];
  readonly previous: readonly ThroughputDay[];
  readonly height?: number;
}

function mutedColor(theme: Theme): string {
  return theme.palette.text.disabled;
}

export function ThroughputChart({ current, previous, height = 240 }: ThroughputChartProps): JSX.Element {
  const theme = useTheme();
  const { color } = useStatusTone("ok");

  const dataset = current.map((day, index) => ({
    dayOffset: `Day ${index + 1}`,
    current: day.count,
    previous: previous[index]?.count ?? 0,
  }));

  return (
    <BarChart
      dataset={dataset}
      height={height}
      xAxis={[{ scaleType: "band", dataKey: "dayOffset" }]}
      series={[
        { id: "current", dataKey: "current", label: "This period", color },
        { id: "previous", dataKey: "previous", label: "Previous period", color: mutedColor(theme) },
      ]}
      slotProps={{ legend: { position: { vertical: "top", horizontal: "end" } } }}
    />
  );
}
