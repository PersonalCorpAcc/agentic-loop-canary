/**
 * ErrorMarker — "this row has a recorded failure" (080 FR-019, FR-020).
 *
 * Deliberately NOT a StatusBadge, and deliberately separate from the state
 * badge it sits beside, because the two say different things:
 *
 *   - the state badge says what EXTRACTION did,
 *   - this says something is broken.
 *
 * The headline case is a run that is legitimately `complete` — green, correct —
 * whose submission then died at deal creation. Folding this into the state
 * would overwrite a true fact with a later one; showing them side by side is
 * the whole point.
 *
 * Colour comes from `useStatusTone` — the one sanctioned outlet for the theme's
 * status tokens (018 R-07, constitution Frontend standard). No raw hex, no
 * eslint-disable.
 *
 * Accessibility (FR-020): colour + a shape (the glyph) + a text label carried
 * in `title` and a visually-hidden span. Never colour alone — the marker has to
 * survive a greyscale screenshot and a colour-blind reader.
 */
import Box from "@mui/material/Box";
import type { JSX, MouseEvent } from "react";

import { useStatusTone } from "./useStatusTone";

export interface ErrorMarkerProps {
  /** Accessible description. Defaults to a generic line; pass something
   *  specific (the failing stage) when the caller knows it. */
  label?: string;
  /** Rendered as a button when set — the History row's click-through. */
  onClick?: () => void;
}

export function ErrorMarker({
  label = "This submission has a recorded failure",
  onClick,
}: ErrorMarkerProps): JSX.Element {
  const { color, bg, border } = useStatusTone("err");
  const interactive = onClick !== undefined;
  return (
    <Box
      component={interactive ? "button" : "span"}
      type={interactive ? "button" : undefined}
      // Propagation is stopped HERE rather than at each call site. The marker's
      // natural home is a clickable row (the History grid's), where a bubbling
      // click would fire the row handler too and navigate twice — landing the
      // operator on the run's default tab instead of its Errors tab, which is
      // the one thing this control exists to reach.
      onClick={
        onClick === undefined
          ? undefined
          : (event: MouseEvent) => {
              event.stopPropagation();
              onClick();
            }
      }
      title={label}
      aria-label={interactive ? label : undefined}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: "999px",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color,
        // The SHAPE half of the redundant encoding — this is what keeps the
        // marker legible without colour.
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        padding: 0,
        cursor: interactive ? "pointer" : "default",
        "&:hover": interactive ? { backgroundColor: border } : undefined,
      }}
    >
      <span aria-hidden="true">!</span>
      {!interactive && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Box>
      )}
    </Box>
  );
}
