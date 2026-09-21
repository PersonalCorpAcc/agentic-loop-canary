/**
 * StatusText — inline text rendered in a status palette colour.
 *
 * Sibling to StatusBadge for contexts where a coloured pill would be too
 * heavy (e.g. SourceList's "quote not verifiable" warning, InFlightPanel
 * elapsed-time hints). Reads its colour through `useStatusTone` (the
 * sanctioned `palette.status` outlet, 018 R-07) rather than the palette
 * directly — this primitive IS a controlled access point.
 */
import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";
import type { ReactNode } from "react";

import type { StatusVariant } from "./StatusBadge";
import { useStatusTone } from "./useStatusTone";

export interface StatusTextProps {
  variant: StatusVariant;
  children: ReactNode;
  component?: TypographyProps["component"];
  role?: string;
  sx?: TypographyProps["sx"];
  size?: "xs" | "sm";
  /** Native tooltip text (hover) — useful for explaining a terse status. */
  title?: string;
}

export function StatusText({
  variant,
  children,
  component = "span",
  role,
  sx,
  size = "sm",
  title,
}: StatusTextProps) {
  const colour = useStatusTone(variant).color;

  const mergedSx = [
    { color: colour, fontSize: size === "xs" ? "0.75rem" : "0.8125rem" },
    ...(sx ? [sx as object] : []),
  ] as TypographyProps["sx"];

  const props: TypographyProps = mergedSx
    ? { component, sx: mergedSx }
    : { component };
  if (role !== undefined) {
    (props as { role?: string }).role = role;
  }
  if (title !== undefined) {
    (props as { title?: string }).title = title;
  }

  return <Typography {...props}>{children}</Typography>;
}
