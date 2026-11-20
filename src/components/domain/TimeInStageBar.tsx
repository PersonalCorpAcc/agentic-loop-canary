/**
 * TimeInStageBar — the Delivery page's "where time goes" section (#165).
 *
 * Renders `timeInStageRows`' output: one horizontal stacked bar per shipped item in the
 * period, or a single averaged bar once there are more than are readable individually. Each
 * segment is coloured through `useStatusTones()` keyed off `FLOW_STYLES[stage].tone` — never
 * `palette.status` directly (AGENTS.md Rule 3) — and given a minimum width so a zero-duration
 * sliver still renders instead of disappearing.
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";

import { HelperText, useStatusTones } from "@/components/primitives";
import { FLOW_STYLES } from "@/lib/statusStyles";

import type { BarRow } from "../../web/timeInStageBar.js";
import type { timeInStageRows } from "../../web/timeInStageBar.js";

const MIN_SEGMENT_WIDTH_PCT = 2;

export interface TimeInStageBarProps {
  readonly result: ReturnType<typeof timeInStageRows>;
}

function BarRowView({ row }: { readonly row: BarRow }): ReactElement {
  const tones = useStatusTones();
  const total = row.segments.reduce((sum, segment) => sum + segment.ms, 0);

  return (
    <Stack
      direction="row"
      sx={{
        height: 12,
        borderRadius: 1,
        overflow: "hidden",
        width: "100%",
      }}
    >
      {row.segments.map((segment) => {
        const share = total > 0 ? (segment.ms / total) * 100 : 100 / row.segments.length;
        const width = Math.max(share, MIN_SEGMENT_WIDTH_PCT);
        const tone = FLOW_STYLES[segment.stage].tone;
        return (
          <Box
            key={segment.stage}
            title={`${FLOW_STYLES[segment.stage].label}: ${Math.round(segment.ms / 3_600_000)}h`}
            sx={{
              width: `${width}%`,
              flexShrink: 0,
              backgroundColor: tones[tone].color,
            }}
          />
        );
      })}
    </Stack>
  );
}

export function TimeInStageBar({ result }: TimeInStageBarProps): ReactElement {
  if (result.mode === "individual") {
    return (
      <Stack spacing={2}>
        {result.rows.map((row) => (
          <Stack key={row.issue} spacing={1}>
            <a href={row.url}>
              #{row.issue} {row.title}
            </a>
            <BarRowView row={row} />
          </Stack>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <BarRowView row={result.row} />
      <HelperText>averaged over {result.count} items</HelperText>
    </Stack>
  );
}
