/**
 * PageHeader — title band shared across every page.
 *
 * US5: a 40px H1 (the reference page-title recipe; menu pages use their nav
 * label as the title), optional subtitle, optional actions cluster on the
 * right, optional meta row beneath. The kicker/eyebrow line is gone — this
 * app uses no kickers and no all-caps.
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 6 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "flex-end" }}
        justifyContent="space-between"
        spacing={3}
      >
        <Box>
          <Typography variant="displayXl" component="h1">
            {title}
          </Typography>
          {subtitle ? (
            <Typography
              variant="body1"
              sx={(theme) => ({ mt: 2, color: theme.palette.text.secondary, maxWidth: 720 })}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {actions ? (
          <Stack direction="row" spacing={2} alignItems="center">
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {meta ? (
        <Box
          sx={(theme) => ({
            mt: 4,
            pt: 3,
            borderTop: `1px solid ${theme.palette.divider}`,
          })}
        >
          {meta}
        </Box>
      ) : null}
    </Box>
  );
}
