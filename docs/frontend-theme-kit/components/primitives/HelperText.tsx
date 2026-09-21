/**
 * HelperText — small secondary-color line used beneath form controls
 * and inline rule descriptions. Centralises the
 * `0.75rem / text.secondary` styling repeated dozens of times across the
 * editor surface.
 */
import Typography, { type TypographyProps } from "@mui/material/Typography";
import type { JSX } from "react";

export interface HelperTextProps {
  readonly children: TypographyProps["children"];
  readonly italic?: boolean;
  /** Inline-display when nested next to another control. Defaults to block. */
  readonly inline?: boolean;
  readonly sx?: TypographyProps["sx"];
  /** Used when this is an aria description label rather than helper text. */
  readonly role?: string;
}

export function HelperText({
  children,
  italic = false,
  inline = false,
  sx,
  role,
}: Readonly<HelperTextProps>): JSX.Element {
  return (
    <Typography
      component={inline ? "span" : "div"}
      role={role}
      sx={[
        (theme) => ({
          fontSize: "0.75rem",
          color: theme.palette.text.secondary,
          ...(italic ? { fontStyle: "italic" } : {}),
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Typography>
  );
}
