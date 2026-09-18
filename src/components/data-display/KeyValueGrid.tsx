/**
 * KeyValueGrid — a two-column `<dl>` of caption-styled key/value pairs (018 T054).
 *
 * The candidate-object field grid (CandidatesExpander) and the array-item field
 * grid (ObjectArrayList) rendered the same `auto 1fr` dl with a bold-caption
 * `dt` + mono `dd` (and "—" for empty values). This centralises it; `sx`
 * passes container tweaks (e.g. `flex: 1`). The value font is the theme mono
 * face for both callers.
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { BoxProps } from "@mui/material/Box";
import { Fragment, type JSX } from "react";

export interface KeyValueGridProps {
  /** Ordered key → value pairs; null/"" values render as an em-dash. */
  readonly entries: Readonly<Record<string, string | null>>;
  /** Container `<dl>` sx passthrough (e.g. `{ flex: 1 }`, `{ mb: 0.5 }`). */
  readonly sx?: BoxProps["sx"];
}

export function KeyValueGrid({ entries, sx }: KeyValueGridProps): JSX.Element {
  return (
    <Box
      component="dl"
      sx={[
        {
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 1.5,
          rowGap: 0.25,
          m: 0,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {Object.entries(entries).map(([k, v]) => (
        <Fragment key={k}>
          <Typography
            component="dt"
            variant="caption"
            sx={(t) => ({ fontWeight: 600, color: t.palette.text.secondary })}
          >
            {k}
          </Typography>
          <Typography
            component="dd"
            variant="caption"
            sx={(t) => ({ m: 0, fontFamily: t.typography.mono.fontFamily })}
          >
            {v === null || v === "" ? "—" : String(v)}
          </Typography>
        </Fragment>
      ))}
    </Box>
  );
}
