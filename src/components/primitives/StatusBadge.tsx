/**
 * StatusBadge — domain-aware status indicator (018 R-07 / T059).
 *
 * Thin composition of the pure `styleFor` mapper (lib/statusStyles) + the pure
 * `Badge` primitive. Callers pass a domain `kind` + `state`; this resolves the
 * tone/icon/label and hands them to `Badge`, which colours them via
 * `useStatusTone`. Rendering is byte-identical to the pre-split component.
 *
 * Accessibility (FR-A11Y-01..03, SC-010): every status ships colour + icon
 * (shape) + text label — never colour alone. A visually-hidden span repeats
 * the label for screen readers.
 */
import type { JSX } from "react";

import { styleFor, type Kind, type StateValue, type Tone } from "@/lib/statusStyles";

import { Badge } from "./Badge";

export type StatusVariant = Tone;

export interface StatusBadgeProps {
  kind: Kind;
  state: StateValue;
}

export function StatusBadge({ kind, state }: StatusBadgeProps): JSX.Element {
  const style = styleFor(kind, state);
  return (
    <Badge
      tone={style.tone}
      icon={style.icon}
      label={style.label}
      srLabel={`${kind} status: ${style.label}`}
    />
  );
}
