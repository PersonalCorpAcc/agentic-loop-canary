/**
 * OptionsBlock — titled bordered box used to group toggles / radios /
 * settings inside a detail pane. The eyebrow title sits flush against
 * the top-left; content fills the body.
 *
 * `collapsible` turns the title into a toggle (chevron); `defaultOpen`
 * controls the initial state (defaults to open).
 */
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import { useState, type JSX, type ReactNode } from "react";

import { Eyebrow } from "@/components/primitives";

export interface OptionsBlockProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly collapsible?: boolean;
  readonly defaultOpen?: boolean;
}

export function OptionsBlock({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: Readonly<OptionsBlockProps>): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  const box = (inner: ReactNode): JSX.Element => (
    <Box
      sx={(theme) => ({
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: `${alpha(theme.palette.paper.muted, 0.4)}`,
        p: 3,
      })}
    >
      {inner}
    </Box>
  );

  if (!collapsible) {
    return box(
      <>
        <Eyebrow sx={{ mb: 2 }}>{title}</Eyebrow>
        {children}
      </>,
    );
  }

  return box(
    <>
      <ButtonBase
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
          <Box
            component="span"
            aria-hidden
            sx={{
              display: "inline-flex",
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 120ms",
              fontSize: 12,
            }}
          >
            ▸
          </Box>
          <Eyebrow>{title}</Eyebrow>
        </Stack>
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Collapse>
    </>,
  );
}
