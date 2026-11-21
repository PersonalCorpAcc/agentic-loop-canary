/**
 * LeadTimeChart — #164's median/p85 lead-time (issue `created_at` to
 * `shipped`, in hours) line chart. Plots the selected period alongside the
 * immediately preceding period of equal length, the previous-period series
 * dashed so it reads as a comparison rather than more current data.
 */
import { useTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import type { JSX } from "react";

import { useStatusTone } from "@/components/primitives";

import type { LeadTimeStats } from "../../web/leadTime.js";

export interface LeadTimeChartProps {
  readonly current: LeadTimeStats;
  readonly previous: LeadTimeStats;
  readonly height?: number;
}

export function LeadTimeChart({ current, previous, height = 240 }: LeadTimeChartProps): JSX.Element {
  const theme = useTheme();
  const currentTone = useStatusTone("info");

  const dataset = [
    { metric: "Median", current: current.median, previous: previous.median },
    { metric: "P85", current: current.p85, previous: previous.p85 },
  ];

  return (
    <LineChart
      dataset={dataset}
      height={height}
      xAxis={[{ dataKey: "metric", scaleType: "band" }]}
      yAxis={[{ label: "Hours" }]}
      series={[
        { dataKey: "current", label: "This period", color: currentTone.color },
        { dataKey: "previous", label: "Previous period", id: "previous", color: theme.palette.text.disabled },
      ]}
      sx={{ "& .MuiLineElement-series-previous": { strokeDasharray: "6 4" } }}
      slotProps={{ legend: { direction: "horizontal", position: { vertical: "top", horizontal: "end" } } }}
    />
  );
}
