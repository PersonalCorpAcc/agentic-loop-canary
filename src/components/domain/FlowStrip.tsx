/**
 * FlowStrip — the Overview page's nine connected stage cards (#162).
 *
 * Renders `flowStripCards`' output, one card per `FLOW_STAGES` entry, left to right, each
 * with a count, stage pill (`StatusBadge kind="flow"`, so tone + icon + label come free),
 * a `@mui/x-charts` sparkline coloured off the theme (not the library's own default palette),
 * and a median-age indicator. A stuck stage (median age past the threshold) adds an amber
 * glow plus an icon+text label — never colour alone (AGENTS.md Rule 3) — mirroring
 * `WaitingOnPersonList`'s `StatusText variant="warn"` pattern. A held count becomes an
 * additional red badge, separate from the base card state. Clicking a card reports the
 * clicked stage; the caller owns the toggle-to-clear semantics via `toggleStageFilter`.
 *
 * Card-enter and count-change transitions are skipped entirely (not shortened) under
 * `prefers-reduced-motion: reduce`, via a CSS media query in `sx` rather than a JS check —
 * this also keeps the component usable in non-DOM test environments.
 */
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import type { JSX } from "react";

import { Badge, StatusBadge, StatusText, useStatusTone } from "@/components/primitives";

import type { FlowStageName } from "../../server/flow.js";
import type { StageCard } from "../../web/flowStrip.js";

function humanizeAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const REDUCED_MOTION_OFF = {
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
    transition: "none",
  },
} as const;

function FlowCardView({
  card,
  selected,
  onSelect,
}: {
  readonly card: StageCard;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): JSX.Element {
  const theme = useTheme();
  const ageTone = useStatusTone(card.stuck ? "warn" : "neutral");

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      sx={{
        position: "relative",
        flex: "1 1 180px",
        minWidth: 180,
        maxWidth: 240,
        cursor: "pointer",
        borderRadius: 1,
        border: `1px solid ${selected ? theme.palette.brand.main : theme.palette.divider}`,
        backgroundColor: selected
          ? alpha(theme.palette.brand.main, 0.06)
          : theme.palette.background.paper,
        boxShadow: card.stuck ? `0 0 0 3px ${alpha(theme.palette.status.warn, 0.35)}` : "none",
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        outline: "none",
        animation: "flow-card-enter 200ms ease",
        transition: "border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease",
        "@keyframes flow-card-enter": {
          from: { opacity: 0, transform: "translateY(4px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "&:focus-visible": {
          boxShadow: `0 0 0 2px ${theme.palette.brand.main}`,
        },
        ...REDUCED_MOTION_OFF,
      }}
    >
      {card.heldCount > 0 ? (
        <Box sx={{ position: "absolute", top: 8, right: 8 }}>
          <Badge tone="err" icon="⚑" label={String(card.heldCount)} srLabel={`${card.heldCount} held`} />
        </Box>
      ) : null}

      <StatusBadge kind="flow" state={card.stage} />

      <Typography
        variant="h4"
        sx={{
          fontVariantNumeric: "tabular-nums",
          transition: "color 160ms ease",
          ...REDUCED_MOTION_OFF,
        }}
      >
        {card.count}
      </Typography>

      <SparkLineChart
        data={card.sparkline.length > 0 ? [...card.sparkline] : [0]}
        height={32}
        color={theme.palette.brand.main}
        showTooltip={false}
        showHighlight={false}
      />

      <Stack direction="row" spacing={1} alignItems="baseline">
        <Typography variant="caption" sx={{ color: ageTone.color }}>
          {humanizeAge(card.medianAgeMs)}
        </Typography>
        {card.stuck ? <StatusText variant="warn">⚠ stuck</StatusText> : null}
      </Stack>
    </Box>
  );
}

function FlowCardSkeleton(): JSX.Element {
  return (
    <Box
      sx={{
        flex: "1 1 180px",
        minWidth: 180,
        maxWidth: 240,
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Skeleton variant="text" width="50%" />
      <Skeleton variant="text" width="30%" height={36} />
      <Skeleton variant="rectangular" height={32} />
      <Skeleton variant="text" width="40%" />
    </Box>
  );
}

export interface FlowStripProps {
  readonly cards: readonly StageCard[];
  readonly selected: FlowStageName | undefined;
  readonly onSelect: (stage: FlowStageName) => void;
  /** First load — nothing to show yet, so render skeleton cards at final size. */
  readonly loading?: boolean;
  /** A refetch with cards already on screen — keep the previous snapshot visible, dimmed. */
  readonly fetching?: boolean;
}

export function FlowStrip({
  cards,
  selected,
  onSelect,
  loading = false,
  fetching = false,
}: FlowStripProps): JSX.Element {
  if (loading) {
    return (
      <Stack direction="row" flexWrap="wrap" gap={2}>
        {Array.from({ length: 9 }, (_, index) => (
          <FlowCardSkeleton key={index} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      gap={2}
      sx={{
        ...(fetching
          ? { opacity: 0.5, pointerEvents: "none", transition: "opacity 120ms" }
          : { transition: "opacity 120ms" }),
      }}
      aria-busy={fetching}
    >
      {cards.map((card) => (
        <FlowCardView
          key={card.stage}
          card={card}
          selected={selected === card.stage}
          onSelect={() => onSelect(card.stage)}
        />
      ))}
    </Stack>
  );
}
