/**
 * ThreePaneLayout — generic three-column layout used by pages with a
 * navigator rail + optional secondary rail + a detail pane.
 *
 * Sized to fill its parent (`height: 100%`), with each column managing
 * its own internal scroll. The middle pane is conditional via
 * `showSecondary`; when hidden, the grid collapses to two columns and
 * the detail pane widens. Below the `md` breakpoint the rails stack.
 *
 * Children should themselves use `height: 100%` / `overflow: auto`
 * (see `RAIL_SX` precedent in the schema editor).
 */
import Box from "@mui/material/Box";
import type { JSX, ReactNode } from "react";

export interface ThreePaneLayoutProps {
  readonly primary: ReactNode;
  readonly secondary?: ReactNode;
  readonly detail: ReactNode;
  readonly showSecondary?: boolean;
  /** Primary rail width at `md`+. Default 300px. */
  readonly primaryWidth?: number | string;
  /** Secondary rail width at `md`+. Default 280px. */
  readonly secondaryWidth?: number | string;
}

export function ThreePaneLayout({
  primary,
  secondary,
  detail,
  showSecondary,
  primaryWidth = 300,
  secondaryWidth = 280,
}: Readonly<ThreePaneLayoutProps>): JSX.Element {
  const visibleSecondary = Boolean(showSecondary && secondary);
  const w = (v: number | string): string =>
    typeof v === "number" ? `${v}px` : v;
  const gridTemplate = visibleSecondary
    ? { md: `${w(primaryWidth)} ${w(secondaryWidth)} 1fr`, xs: "1fr" }
    : { md: `${w(primaryWidth)} 1fr`, xs: "1fr" };
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        gap: 3,
        height: "100%",
        minHeight: 0,
        alignItems: "stretch",
      }}
    >
      {primary}
      {visibleSecondary ? secondary : null}
      {detail}
    </Box>
  );
}
