/**
 * CollapsibleCard — RiskPoint-themed paper card with foldaway body.
 *
 * Composes layout/Section's paper chrome with an MUI Collapse animation.
 * The card sits on the app ground; titles set in the display variant;
 * optional right-slot uses micro-tracked uppercase for the term-sheet voice.
 */
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState, type JSX, type ReactNode } from "react";

import { Rule } from "@/components/primitives";

interface Props {
  readonly title: ReactNode;
  readonly rightSlot?: ReactNode;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

export function CollapsibleCard({
  title,
  rightSlot,
  defaultOpen = true,
  children,
}: Readonly<Props>): JSX.Element {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <Box
      component="section"
      sx={(theme) => ({
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: "background.paper",
        boxShadow: theme.shadows[1],
        transition: "box-shadow 200ms",
        "&:hover": { boxShadow: theme.shadows[2] },
      })}
    >
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
          px: 5,
          py: 3.5,
          textAlign: "left",
        }}
      >
        <Stack direction="row" alignItems="baseline" spacing={3}>
          <Typography
            variant="mono"
            component="span"
            aria-hidden
            sx={(theme) => ({
              fontSize: 11,
              color: theme.palette.brand[300],
              transition: "color 120ms",
              ".MuiButtonBase-root:hover &": { color: theme.palette.accent.main },
            })}
          >
            {open ? "—" : "+"}
          </Typography>
          <Typography
            component="h2"
            sx={(theme) => ({
              fontFamily: theme.typography.displayMd.fontFamily,
              fontSize: 17,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              color: theme.palette.brand.main,
            })}
          >
            {title}
          </Typography>
        </Stack>
        {rightSlot ? (
          <Typography
            variant="mono"
            component="span"
            sx={(theme) => ({
              fontSize: 11,
              textTransform: "none",
              letterSpacing: 0,
              color: theme.palette.text.secondary,
            })}
          >
            {rightSlot}
          </Typography>
        ) : null}
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ mx: 5 }}>
          <Rule />
        </Box>
        <Box sx={{ px: 5, pb: 5, pt: 4 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}
