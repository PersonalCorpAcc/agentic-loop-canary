/**
 * AccentLink — inline entity link: bold brand text with an accent-coloured
 * underline (018 T053).
 *
 * The "click the project name to open the run/schema" affordance was
 * inlined with the same sx across History columns, the dashboard lists,
 * RunView and SchemaEditor (and FieldComparison, until that page was
 * removed). This centralises it;
 * the underline shifts to the brand colour on hover.
 */
import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";
import type { JSX, ReactNode, MouseEventHandler } from "react";
import { Link as RouterLink } from "react-router-dom";

export interface AccentLinkProps {
  /** Router destination. */
  readonly to: string;
  readonly children: ReactNode;
  /** e.g. stopPropagation when the link sits inside a clickable grid row. */
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
  readonly sx?: TypographyProps["sx"];
}

export function AccentLink({ to, children, onClick, sx }: AccentLinkProps): JSX.Element {
  return (
    <Typography
      component={RouterLink}
      to={to}
      onClick={onClick}
      sx={[
        (theme) => ({
          fontWeight: 600,
          color: theme.palette.brand.main,
          textDecoration: "underline",
          textDecorationColor: theme.palette.accent.main,
          textUnderlineOffset: "4px",
          "&:hover": { textDecorationColor: theme.palette.brand.main },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Typography>
  );
}
