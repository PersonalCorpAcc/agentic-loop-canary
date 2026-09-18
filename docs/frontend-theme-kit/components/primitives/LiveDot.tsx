/**
 * LiveDot — animated heartbeat pulse for streaming indicators.
 * Replaces .rp-live-dot. Keyframes are registered globally in
 * theme/components.ts MuiCssBaseline (@keyframes rp-pulse).
 */
import Box from "@mui/material/Box";

export interface LiveDotProps {
  size?: number;
  label?: string;
}

export function LiveDot({ size = 7, label }: LiveDotProps) {
  return (
    <Box
      role={label ? "status" : undefined}
      aria-label={label}
      sx={(theme) => ({
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: theme.palette.accent.main,
        animation: "rp-pulse 1.6s ease-in-out infinite",
      })}
    />
  );
}
