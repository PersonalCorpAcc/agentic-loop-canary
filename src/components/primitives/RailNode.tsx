/**
 * RailNode — selectable rail row used by tree and list rails.
 *
 *   [leading] [ label / subLabel ] [trailing]
 *
 * Leading and trailing slots are siblings of the clickable label area —
 * so a drag handle, collapse chevron, or trailing chips can carry their
 * own click handlers without conflicting with the row's `onClick`.
 *
 * Two visual variants:
 *
 *  • `flat` (default) — accent-tinted background when selected, hover
 *    swap to `paper.muted`. Used for in-rail tree rows (groups, fields).
 *
 *  • `card`            — bordered white card; accent-tinted border +
 *    background when selected. Used for standalone option rows inside
 *    the OptionsRail's virtualized list.
 */
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { JSX, ReactNode } from "react";

export type RailNodeVariant = "flat" | "card";

export interface RailNodeProps {
  readonly label: ReactNode;
  readonly onClick: () => void;
  readonly selected?: boolean;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly subLabel?: ReactNode;
  readonly variant?: RailNodeVariant;
  /** When true and `label` is falsy, the label area renders a dim
   *  `(unnamed)` placeholder. */
  readonly emptyLabel?: string;
  /** ARIA aria-current toggle when selected. */
  readonly ariaCurrent?: boolean;
}

export function RailNode({
  label,
  onClick,
  selected = false,
  leading,
  trailing,
  subLabel,
  variant = "flat",
  emptyLabel = "(unnamed)",
  ariaCurrent = true,
}: Readonly<RailNodeProps>): JSX.Element {
  const showEmpty = !label && typeof label !== "number";
  const isCard = variant === "card";
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={(theme) => {
        if (isCard) {
          return {
            mx: 1,
            my: 0.25,
            border: `1px solid ${
              selected ? theme.palette.accent.main : theme.palette.divider
            }`,
            borderRadius: 1,
            backgroundColor: selected
              ? theme.palette.accent[50] ?? theme.palette.paper.muted
              : "background.paper",
            px: 0.5,
            "&:hover": { backgroundColor: theme.palette.paper.muted },
          };
        }
        return {
          py: 0.5,
          px: 1,
          borderRadius: 1,
          backgroundColor: selected
            ? theme.palette.accent[50] ?? theme.palette.paper.muted
            : "transparent",
          "&:hover": { backgroundColor: theme.palette.paper.muted },
        };
      }}
    >
      {leading ?? null}
      <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-current={selected && ariaCurrent ? "true" : undefined}
        sx={{
          flex: 1,
          textAlign: "left",
          cursor: "pointer",
          border: 0,
          backgroundColor: "transparent",
          py: isCard ? 1 : 0.25,
          px: isCard ? 1 : 0,
          minWidth: 0,
        }}
      >
        <Typography
          component="span"
          sx={(theme) => ({
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: selected ? 600 : 500,
            color: showEmpty
              ? theme.palette.brand[300]
              : theme.palette.brand.main,
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "nowrap",
          })}
        >
          {showEmpty ? emptyLabel : label}
        </Typography>
        {subLabel ? (
          <Typography
            variant="labelSm"
            component="span"
            sx={(theme) => ({
              display: "block",
              color: theme.palette.text.secondary,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            })}
          >
            {subLabel}
          </Typography>
        ) : null}
      </Box>
      {trailing ?? null}
    </Stack>
  );
}
