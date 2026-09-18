/**
 * Module augmentation for the MUI v6 theme.
 *
 * - Adds `brand` / `paper` / `accent` / `status` plus the semantic slots
 *   `border` / `surface` (FR-024) to Palette + PaletteOptions so components
 *   can read `theme.palette.brand.main`, `theme.palette.border.strong`,
 *   etc., with full type safety.
 * - Adds custom typography variants (`displayXl` / `displayLg` / `displayMd` /
 *   `eyebrow` / `mono` / `labelSm` / `tableCell`) so
 *   `<Typography variant="displayXl">` is type-checked.
 */
import "@mui/material/styles";
import "@mui/material/Typography";
import type { CSSProperties } from "react";

declare module "@mui/material/styles" {
  interface BrandColor {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
  }

  interface AccentColor {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
  }

  interface PaperColor {
    main: string;
    ink: string;
    rule: string;
    ruleStrong: string;
    muted: string;
  }

  interface StatusColor {
    ok: string;
    warn: string;
    err: string;
    info: string;
    neutral: string;
  }

  interface BorderColor {
    strong: string;
  }

  interface SurfaceColor {
    raised: string;
    muted: string;
  }

  interface Palette {
    brand: BrandColor;
    paper: PaperColor;
    accent: AccentColor;
    status: StatusColor;
    border: BorderColor;
    surface: SurfaceColor;
  }

  interface PaletteOptions {
    brand?: Partial<BrandColor>;
    paper?: Partial<PaperColor>;
    accent?: Partial<AccentColor>;
    status?: Partial<StatusColor>;
    border?: Partial<BorderColor>;
    surface?: Partial<SurfaceColor>;
  }

  interface TypographyVariants {
    displayXl: CSSProperties;
    displayLg: CSSProperties;
    displayMd: CSSProperties;
    eyebrow: CSSProperties;
    mono: CSSProperties;
    labelSm: CSSProperties;
    tableCell: CSSProperties;
  }

  interface TypographyVariantsOptions {
    displayXl?: CSSProperties;
    displayLg?: CSSProperties;
    displayMd?: CSSProperties;
    eyebrow?: CSSProperties;
    mono?: CSSProperties;
    labelSm?: CSSProperties;
    tableCell?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    displayXl: true;
    displayLg: true;
    displayMd: true;
    eyebrow: true;
    mono: true;
    labelSm: true;
    tableCell: true;
  }
}

export {};
