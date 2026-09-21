/**
 * Pill — generic small label/tag chrome. Used by FieldRow, BatchRow,
 * SourceList, ActivityStrip, InFlightPanel, CallTimeline, RunUsageBar.
 *
 * `tone` selects the visual treatment; default is paper-muted with a rule
 * border (the dominant pre-migration look).
 */
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

export type PillTone = "default" | "muted" | "accent" | "outline" | "ink";

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  title?: string;
  size?: "xs" | "sm";
}

function styleForTone(tone: PillTone) {
  return (theme: import("@mui/material/styles").Theme) => {
    switch (tone) {
      case "muted":
        return {
          backgroundColor: theme.palette.paper.muted,
          color: theme.palette.text.secondary,
          border: `1px solid ${theme.palette.divider}`,
        };
      case "accent":
        return {
          backgroundColor: theme.palette.accent[100],
          color: theme.palette.accent.dark,
          border: `1px solid ${theme.palette.accent[300]}`,
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          color: theme.palette.brand.main,
          border: `1px solid ${theme.palette.border.strong}`,
        };
      case "ink":
        return {
          backgroundColor: theme.palette.brand.main,
          color: theme.palette.paper.main,
          border: `1px solid ${theme.palette.brand.main}`,
        };
      case "default":
      default:
        return {
          backgroundColor: "background.paper",
          color: theme.palette.brand.main,
          border: `1px solid ${theme.palette.divider}`,
        };
    }
  };
}

export function Pill({ tone = "default", children, title, size = "sm" }: PillProps) {
  const padding = size === "xs" ? "1px 6px" : "2px 8px";
  const fontSize = size === "xs" ? "9px" : "10px";
  return (
    <Box
      component="span"
      title={title}
      sx={(theme) => ({
        ...styleForTone(tone)(theme),
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        borderRadius: 999,
        padding,
        fontSize,
        fontWeight: 600,
        letterSpacing: 0,
        textTransform: "none",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      })}
    >
      {children}
    </Box>
  );
}
