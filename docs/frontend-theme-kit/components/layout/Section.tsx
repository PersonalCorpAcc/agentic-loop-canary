/**
 * Section — themed paper-shadow card.
 *
 * Replaces the
 *   <div className="rounded-card border border-paper-rule bg-white p-N shadow-paper">
 * pattern duplicated across pages and components. Optional title + actions
 * chrome at the top (US5 dropped the kicker/eyebrow line above the title).
 *
 * variant="muted" tones the background down to paper.muted for nested
 * sections (e.g. rationale blocks).
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export interface SectionProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  dense?: boolean;
  variant?: "paper" | "muted";
}

export function Section({
  title,
  actions,
  children,
  dense = false,
  variant = "paper",
}: SectionProps) {
  const padding = dense ? 3 : 5;
  return (
    <Box
      component="section"
      sx={(theme) => ({
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: variant === "muted" ? theme.palette.paper.muted : "background.paper",
        boxShadow: variant === "muted" ? "none" : theme.shadows[1],
        p: padding,
      })}
    >
      {(title || actions) && (
        <Stack
          direction="row"
          alignItems="flex-end"
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 4 }}
        >
          <Box>
            {title ? (
              <Typography variant="displayMd" component="h2">
                {title}
              </Typography>
            ) : null}
          </Box>
          {actions ? (
            <Stack direction="row" spacing={1} alignItems="center">
              {actions}
            </Stack>
          ) : null}
        </Stack>
      )}
      {children}
    </Box>
  );
}
