/**
 * Toolbar — sticky-able action row used by RunView, BatchView, SchemaEditor.
 *
 * `variant="page"` draws a rule above + below; `variant="section"` draws
 * only a bottom rule and is intended for in-section toolbars.
 */
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import type { ReactNode } from "react";

export interface ToolbarProps {
  children: ReactNode;
  sticky?: boolean;
  variant?: "page" | "section";
}

export function Toolbar({ children, sticky = false, variant = "page" }: ToolbarProps) {
  return (
    <Box
      sx={(theme) => ({
        ...(sticky
          ? {
              position: "sticky",
              top: 0,
              zIndex: 10,
              backgroundColor: `${alpha(theme.palette.paper.main, 0.949)}`,
              backdropFilter: "blur(4px)",
            }
          : {}),
        borderBottom: `1px solid ${theme.palette.divider}`,
        ...(variant === "page"
          ? { borderTop: `1px solid ${theme.palette.divider}` }
          : {}),
        py: 2,
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        flexWrap="wrap"
        useFlexGap
      >
        {children}
      </Stack>
    </Box>
  );
}
