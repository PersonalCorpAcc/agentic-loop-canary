import { createTheme } from "@mui/material/styles";

import "./module-augmentation";
import { palette } from "./palette";
import { typography } from "./typography";
import { shape } from "./shape";
import { shadows } from "./shadows";
import { components } from "./components";

/**
 * RiskPoint MUI v6 theme. Single source of truth for design tokens.
 *
 * Spacing base is 4 px (matches Tailwind's 4px step). `<Box sx={{ p: 1 }}>`
 * therefore equals the previous Tailwind `p-1` (4 px).
 */
export const theme = createTheme({
  palette,
  typography,
  shape,
  shadows,
  spacing: 4,
  components,
});

export type AppTheme = typeof theme;
