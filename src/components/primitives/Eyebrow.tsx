/**
 * Eyebrow — small uppercase tracking-micro label.
 * Replaces the .rp-eyebrow CSS class. Maps to <Typography variant="eyebrow">.
 */
import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";
import type { ElementType, ReactNode } from "react";

export interface EyebrowProps {
  children: ReactNode;
  component?: ElementType;
  color?: TypographyProps["color"];
  sx?: TypographyProps["sx"];
  htmlFor?: string;
}

export function Eyebrow({ children, component = "span", color, sx, htmlFor }: EyebrowProps) {
  const passProps: TypographyProps & { htmlFor?: string } = {
    variant: "eyebrow",
    component,
    color: color ?? "text.secondary",
  };
  if (sx !== undefined) {
    passProps.sx = sx;
  }
  if (htmlFor !== undefined) {
    passProps.htmlFor = htmlFor;
  }
  return <Typography {...passProps}>{children}</Typography>;
}
