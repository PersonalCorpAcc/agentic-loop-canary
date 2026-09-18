/**
 * CopyButton — small icon button that writes a string to the clipboard
 * and flashes a "Copied" affordance for ~1.2s.
 *
 * Used in read-only contexts (e.g. frozen schema versions) where the user
 * needs to copy a field description or enum option without being able to
 * edit it.
 */
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useRef, useState, type JSX } from "react";

import { useStatusTone } from "./useStatusTone";

export interface CopyButtonProps {
  readonly value: string;
  readonly ariaLabel?: string;
  readonly size?: "small" | "medium";
}

export function CopyButton({
  value,
  ariaLabel = "Copy to clipboard",
  size = "small",
}: Readonly<CopyButtonProps>): JSX.Element {
  const [copied, setCopied] = useState<boolean>(false);
  const okColor = useStatusTone("ok").color;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Tooltip title={copied ? "Copied" : "Copy"} placement="top" arrow>
      <IconButton
        size={size}
        onClick={handleCopy}
        aria-label={ariaLabel}
        disabled={value.length === 0}
        sx={(theme) => ({
          fontFamily: theme.typography.mono.fontFamily,
          fontSize: "0.6875rem",
          letterSpacing: 0,
          textTransform: "none",
          color: copied ? okColor : theme.palette.text.secondary,
          "&:hover": { color: theme.palette.brand.main },
        })}
      >
        {copied ? "✓" : "⧉"}
      </IconButton>
    </Tooltip>
  );
}
