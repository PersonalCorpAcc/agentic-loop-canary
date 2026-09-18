/**
 * TooltipIconButton — IconButton with a Tooltip and a `<span>` wrapper
 * that makes the tooltip survive the disabled state. Removes the
 * three-deep `<Tooltip><span><IconButton .../></span></Tooltip>` ritual
 * everywhere a small action button needs a hover label.
 */
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import Tooltip, { type TooltipProps } from "@mui/material/Tooltip";
import type { JSX, ReactNode } from "react";

export interface TooltipIconButtonProps
  extends Omit<IconButtonProps, "children" | "title"> {
  readonly title: TooltipProps["title"];
  readonly icon: ReactNode;
  /** Required for screen readers; same value typically as `title`. */
  readonly ariaLabel: string;
  readonly tooltipPlacement?: TooltipProps["placement"];
}

export function TooltipIconButton({
  title,
  icon,
  ariaLabel,
  tooltipPlacement,
  ...iconButtonProps
}: Readonly<TooltipIconButtonProps>): JSX.Element {
  // MUI Tooltip doesn't fire on disabled triggers; the <span> wrapper
  // gives it a focusable parent so the title still shows up.
  return (
    <Tooltip
      title={title}
      {...(tooltipPlacement ? { placement: tooltipPlacement } : {})}
    >
      <span>
        <IconButton size="small" aria-label={ariaLabel} {...iconButtonProps}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
