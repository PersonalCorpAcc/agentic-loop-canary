/**
 * MicroText — the small mono caption used app-wide (018 T053; US5 dropped
 * the all-caps treatment — this app uses no uppercase styling anywhere).
 *
 * ~30 call sites inlined `variant="mono"` + a small `fontSize` + a muted
 * colour. This centralises that boilerplate; `size` and `dim` reproduce the
 * per-site variants (fontSize 10/11, text.secondary vs fainter brand[300]).
 */
import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";
import type { JSX, ReactNode } from "react";

export interface MicroTextProps {
  readonly children: ReactNode;
  /** Font size in px. Defaults to 11 (the common caption size). */
  readonly size?: number;
  /** Use the fainter brand[300] instead of the default text.secondary. */
  readonly dim?: boolean;
  readonly component?: TypographyProps["component"];
  readonly sx?: TypographyProps["sx"];
}

export function MicroText({
  children,
  size = 11,
  dim,
  component = "span",
  sx,
}: MicroTextProps): JSX.Element {
  return (
    <Typography
      variant="mono"
      component={component}
      sx={[
        (theme) => ({
          fontSize: size,
          textTransform: "none",
          letterSpacing: 0,
          color: dim ? theme.palette.brand[300] : theme.palette.text.secondary,
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Typography>
  );
}
