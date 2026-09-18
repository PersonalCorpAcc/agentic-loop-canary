import type { Components, Theme } from "@mui/material/styles";

import { dialogRadius } from "./shape";
import { typographyFamilies } from "./typography";

/**
 * App-wide component overrides — US5 design language (018 T073/T075), per
 * the verbatim recipes in `specs/018-frontend-refactor/design-reference.md`.
 *
 * CssBaseline emits the `--rp-*` CSS variables from theme tokens — the ONLY
 * `:root` source for them (the static literal block in `styles/index.css`
 * was deleted by 018 T070). The `@media print` rules in
 * `frontend/src/styles/index.css` consume the `--rp-font-*` family vars —
 * `--rp-font-serif` now resolves to the sans stack (the serif face is
 * retired), so the print export follows the theme with no CSS edit — the
 * var name is kept so the print stylesheet needs no churn; print COLORS stay
 * deliberately literal there (document-first neutral inks).
 *
 * The ivory-era paper-grain body::before overlay is retired (T073) — the
 * reference is a flat putty ground.
 */
export const components: Components<Omit<Theme, "components">> = {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      ":root": {
        "--rp-ink": theme.palette.brand.main,
        "--rp-ink-2": theme.palette.brand[500],
        "--rp-ink-3": theme.palette.brand[400],
        "--rp-ink-muted": theme.palette.brand[300],
        "--rp-paper": theme.palette.paper.main,
        "--rp-paper-muted": theme.palette.paper.muted,
        "--rp-rule": theme.palette.paper.rule,
        "--rp-rule-strong": theme.palette.paper.ruleStrong,
        "--rp-accent": theme.palette.accent.main,
        "--rp-accent-soft": theme.palette.accent[100],
        "--rp-font-sans": typographyFamilies.sans,
        "--rp-font-serif": typographyFamilies.sans,
        "--rp-font-mono": typographyFamilies.mono,
      },
      body: {
        backgroundColor: theme.palette.paper.main,
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      },
      "#root": {
        position: "relative",
        zIndex: 1,
      },
      ":focus-visible": {
        outline: `2px solid ${theme.palette.brand.main}`,
        outlineOffset: "2px",
        borderRadius: "2px",
      },
      ".sr-only": {
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      },
      ".font-mono": {
        fontFeatureSettings: '"tnum", "zero"',
      },
      "@keyframes rp-pulse": {
        "0%, 100%": { opacity: 0.45, transform: "scale(0.9)" },
        "50%": { opacity: 1, transform: "scale(1)" },
      },
    }),
  },

  MuiButton: {
    defaultProps: {
      disableElevation: true,
      variant: "outlined",
    },
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 36,
        borderRadius: theme.shape.borderRadius,
        textTransform: "none",
        fontWeight: 600,
        letterSpacing: "0.01em",
      }),
      containedPrimary: ({ theme }) => ({
        backgroundColor: theme.palette.brand.main,
        color: theme.palette.common.white,
        "&:hover": { backgroundColor: theme.palette.brand.dark },
        "&:active": { backgroundColor: theme.palette.brand.dark },
        "&.Mui-disabled": {
          backgroundColor: theme.palette.brand.main,
          color: theme.palette.common.white,
          opacity: 0.6,
        },
      }),
      outlined: ({ theme }) => ({
        borderColor: theme.palette.border.strong,
        color: "#475569", // reference secondary-button text: slate-600
        fontWeight: 500,
        "&:hover": {
          backgroundColor: theme.palette.surface.muted,
          borderColor: theme.palette.border.strong,
        },
        "&:active": { backgroundColor: theme.palette.paper.muted },
      }),
      text: ({ theme }) => ({
        color: theme.palette.text.secondary,
        "&:hover": { color: theme.palette.brand.main, backgroundColor: "transparent" },
      }),
    },
  },

  MuiPaper: {
    defaultProps: {
      elevation: 1,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: "none",
      }),
    },
  },

  MuiTable: {
    defaultProps: { size: "small" },
  },
  // Reference table chrome (design-reference.md): thead `bg-slate-50
  // text-slate-500`, th `px-4 py-3 font-medium`, body `text-sm` rows with
  // slate-100 dividers. Header text is 14px/500 slate-500, normal case.
  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.surface.muted,
        "& th": { backgroundColor: theme.palette.surface.muted },
        "& tr": { borderBottom: `1px solid ${theme.palette.divider}` },
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: "12px 16px",
        borderBottom: `1px solid ${theme.palette.paper.muted}`,
        fontSize: "0.875rem",
      }),
      head: ({ theme }) => ({
        fontFamily: theme.typography.fontFamily,
        fontSize: "0.875rem",
        fontWeight: 500,
        letterSpacing: 0,
        textTransform: "none",
        color: theme.palette.text.secondary,
      }),
    },
  },

  MuiTextField: {
    defaultProps: {
      variant: "outlined",
      size: "small",
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        "& fieldset": { borderColor: theme.palette.border.strong },
        "&:hover fieldset": { borderColor: theme.palette.text.secondary },
        "&.Mui-focused fieldset": {
          borderColor: theme.palette.text.secondary,
          borderWidth: 1,
        },
        "&.Mui-focused": {
          boxShadow: `0 0 0 2px ${theme.palette.divider}`,
        },
      }),
    },
  },

  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.brand.main,
        color: theme.palette.common.white,
        fontSize: "0.75rem",
        fontWeight: 500,
        padding: "6px 8px",
      }),
      arrow: ({ theme }) => ({ color: theme.palette.brand.main }),
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: dialogRadius,
        boxShadow: theme.shadows[2],
      }),
    },
  },

  // Segmented pill tabs per the reference: active = ink fill + white text,
  // inactive = white + slate border. The MUI underline indicator is hidden.
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 0 },
      indicator: { display: "none" },
      flexContainer: { gap: 8 },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 0,
        padding: "8px 16px",
        borderRadius: 999,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        textTransform: "none",
        letterSpacing: 0,
        fontSize: "14px",
        fontWeight: 600,
        color: theme.palette.brand[500],
        "&.Mui-selected": {
          backgroundColor: theme.palette.brand.main,
          borderColor: theme.palette.brand.main,
          color: theme.palette.common.white,
        },
      }),
    },
  },

  MuiToggleButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        textTransform: "none",
        fontWeight: 600,
        color: theme.palette.brand[500],
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
        "&.Mui-selected": {
          backgroundColor: theme.palette.brand.main,
          color: theme.palette.common.white,
          "&:hover": { backgroundColor: theme.palette.brand.dark },
        },
      }),
    },
  },

  MuiLink: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.palette.brand.main,
        textDecorationColor: "currentColor",
        textUnderlineOffset: "4px",
      }),
    },
  },
};
