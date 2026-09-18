/**
 * RailFrame — vertical rail shell with bordered card + internal scroll body.
 *
 *   ┌─ header ──────────────────────┐
 *   ├─ filter (optional) ──────────┤
 *   │                              │
 *   │ children (scrollable body)   │
 *   │                              │
 *   ├─ footer (optional) ──────────┤
 *   └──────────────────────────────┘
 *
 * Fills its parent (`height: 100%`); the body region grows and owns its
 * own scroll so the page-level footer stays viewport-pinned. Header and
 * footer regions, if present, sit flush above and below.
 */
import Box from "@mui/material/Box";
import type { JSX, ReactNode } from "react";

export interface RailFrameProps {
  readonly header: ReactNode;
  readonly filter?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  /** Padding inside the scrollable body. Defaults to a tight rail-friendly
   *  set; callers with virtualized children pass `bodyPadding={0}`. */
  readonly bodyPadding?: number | string;
}

export function RailFrame({
  header,
  filter,
  footer,
  children,
  bodyPadding = 1,
}: Readonly<RailFrameProps>): JSX.Element {
  return (
    <Box
      sx={(theme) => ({
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: "background.paper",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      })}
    >
      <Box
        sx={(theme) => ({
          flexShrink: 0,
          borderBottom: `1px solid ${theme.palette.divider}`,
        })}
      >
        {header}
      </Box>
      {filter ? (
        <Box sx={{ flexShrink: 0, px: 1.5, py: 1 }}>{filter}</Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: bodyPadding }}>
        {children}
      </Box>
      {footer ? (
        <Box
          sx={(theme) => ({
            flexShrink: 0,
            borderTop: `1px solid ${theme.palette.divider}`,
            p: 1.5,
          })}
        >
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}
