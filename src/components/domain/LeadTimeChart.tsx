/**
 * LeadTimeChart — the Delivery page's lead-time trend (#164): a `@mui/x-charts` line chart
 * plotting `{median, p85}` lead time in hours for the selected period, solid, alongside the
 * immediately preceding period of equal length, dashed and in a muted tone, with a legend
 * distinguishing "this period" from "previous period". `@mui/x-charts`' `LineSeriesType` has no
 * native dash prop, so the previous-period series is dashed via an `sx` override targeting the
 * library's generated `MuiLineElement-series-{id}` class for that series id.
 */
import { LineChart } from "@mui/x-charts/LineChart";
import { useTheme, type Theme } from "@mui/material/styles";
import type { JSX } from "react";

import { useStatusTone } from "@/components/primitives";

import type { LeadTimeStats } from "../../web/leadTime.js";

export interface LeadTimeChartProps {
  readonly current: LeadTimeStats;
  readonly previous: LeadTimeStats;
  readonly height?: number;
}

function mutedColor(theme: Theme): string {
  return theme.palette.text.disabled;
}

export function LeadTimeChart({ current, previous, height = 240 }: LeadTimeChartProps): JSX.Element {
  const theme = useTheme();
  const { color } = useStatusTone("info");

  const dataset = [
    { metric: "Median", current: current.median, previous: previous.median },
    { metric: "P85", current: current.p85, previous: previous.p85 },
  ];

  return (
    <LineChart
      dataset={dataset}
      height={height}
      xAxis={[{ scaleType: "point", dataKey: "metric" }]}
      yAxis={[{ label: "Hours" }]}
      series={[
        { id: "current", dataKey: "current", label: "This period", color },
        { id: "previous", dataKey: "previous", label: "Previous period", color: mutedColor(theme) },
      ]}
      sx={{ "& .MuiLineElement-series-previous": { strokeDasharray: "6 4" } }}
      slotProps={{ legend: { position: { vertical: "top", horizontal: "end" } } }}
    />
  );
}
