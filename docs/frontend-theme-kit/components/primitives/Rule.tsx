/**
 * Rule — horizontal rule primitive. Replaces .rp-rule + .rp-rule-accent.
 *
 * variant="accent" renders the brand wordmark's gold-tipped rule (used in the
 * AppShell header band; preserved from the original Tailwind design).
 */
import Box from "@mui/material/Box";

export interface RuleProps {
  variant?: "plain" | "accent";
}

export function Rule({ variant = "plain" }: RuleProps) {
  if (variant === "accent") {
    return (
      <Box
        aria-hidden
        sx={(theme) => ({
          height: 2,
          background: `linear-gradient(
            90deg,
            ${theme.palette.brand.main} 0%,
            ${theme.palette.brand.main} 30%,
            ${theme.palette.accent.main} 30%,
            ${theme.palette.accent.main} 45%,
            ${theme.palette.divider} 45%,
            ${theme.palette.divider} 100%
          )`,
        })}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={(theme) => ({ height: 1, backgroundColor: theme.palette.divider })}
    />
  );
}
