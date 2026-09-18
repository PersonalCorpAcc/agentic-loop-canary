/**
 * DetailHeader — sticky-top header for a detail pane. Renders a breadcrumb
 * trail (last segment emphasized) with right-aligned action icons /
 * buttons. Used by any list-detail or rail-detail layout.
 *
 * When `onBack` is supplied, a back-arrow button is prepended to the
 * breadcrumb so the analyst can return to the parent (rail root) without
 * having to scroll the rail to find it again.
 */
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { JSX, ReactNode } from "react";

export interface DetailHeaderProps {
  readonly breadcrumb: readonly string[];
  readonly actions?: ReactNode;
  /** When set, renders a back-arrow button to the left of the breadcrumb.
   *  Provide an aria-friendly `backLabel` describing where the click goes
   *  (e.g. "Back to run summary"). */
  readonly onBack?: () => void;
  readonly backLabel?: string;
}

export function DetailHeader({
  breadcrumb,
  actions,
  onBack,
  backLabel = "Back",
}: Readonly<DetailHeaderProps>): JSX.Element {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={(theme) => ({
        pb: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{ flex: 1, minWidth: 0 }}
      >
        {onBack ? (
          <Tooltip title={backLabel}>
            <IconButton
              size="small"
              onClick={onBack}
              aria-label={backLabel}
              sx={(theme) => ({
                color: theme.palette.text.secondary,
                "&:hover": { color: theme.palette.brand.main },
              })}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        {breadcrumb.map((crumb, i) => (
          <Box
            key={`${crumb}-${i}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              minWidth: 0,
            }}
          >
            {i > 0 ? (
              <Typography
                variant="tableCell"
                sx={(theme) => ({
                  color: theme.palette.brand[300],
                  fontFamily: theme.typography.mono.fontFamily,
                })}
              >
                ›
              </Typography>
            ) : null}
            <Typography
              sx={(theme) => ({
                fontSize: i === breadcrumb.length - 1 ? "1rem" : "0.8125rem",
                fontWeight: i === breadcrumb.length - 1 ? 700 : 500,
                color:
                  i === breadcrumb.length - 1
                    ? theme.palette.brand.main
                    : theme.palette.text.secondary,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
              })}
            >
              {crumb}
            </Typography>
          </Box>
        ))}
      </Stack>
      {actions ? (
        <Stack direction="row" spacing={0.5}>
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
