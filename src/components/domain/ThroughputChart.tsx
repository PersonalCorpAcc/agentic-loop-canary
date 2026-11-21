/**
 * ThroughputChart — #164's "shipped items per day" bar chart. Plots the
 * selected period alongside the immediately preceding period of equal length
 * (aligned by day offset, since the two windows cover different calendar
 * dates), muted so it reads as a comparison series rather than more data for
 * the current period.
 */
import { useTheme } from "@mui/material/styles";
import { BarChart } from "@mui/x-charts/BarChart";
import type { JSX } from "react";

import { useStatusTone } from "@/components/primitives";

import type { ThroughputDay } from "../../web/throughput.js";

export interface ThroughputChartProps {
  readonly current: readonly ThroughputDay[];
  readonly previous: readonly ThroughputDay[];
  readonly height?: number;
}

export function ThroughputChart({ current, previous, height = 240 }: ThroughputChartProps): JSX.Element {
  const theme = useTheme();
  const currentTone = useStatusTone("ok");

  const dataset = current.map((day, index) => ({
    dayOffset: index + 1,
    current: day.count,
    previous: previous[index]?.count ?? 0,
  }));

  return (
    <BarChart
      dataset={dataset}
      height={height}
      xAxis={[{ dataKey: "dayOffset", scaleType: "band", label: "Day" }]}
      series={[
        { dataKey: "current", label: "This period", color: currentTone.color },
        { dataKey: "previous", label: "Previous period", color: theme.palette.text.disabled },
      ]}
      slotProps={{ legend: { direction: "horizontal", position: { vertical: "top", horizontal: "end" } } }}
    />
  );
}
