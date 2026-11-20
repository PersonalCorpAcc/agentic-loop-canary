/**
 * FlowStrip — the Overview page's nine-card flow strip (#162).
 *
 * One card per {@link FLOW_STAGES} entry, always in table order, always all nine (a
 * zero-count stage still renders a card showing `0` — never omitted). Clicking a card
 * toggles it as the work item table's filter; `toggleStageFilter` (src/web/flowStrip.ts)
 * owns that pure select/clear transition, this component just calls back with its result.
 *
 * Stuck cards (median age over the threshold) get an amber glow PLUS an icon and a text
 * label — never colour alone (AGENTS.md Rule 3 / WCAG 1.4.1, the same rule `StatusText`'s
 * own stuck treatment follows). Held cards get an additional red count badge, layered on
 * top of the base card rather than replacing its state.
 *
 * The flex row wraps rather than shrinking cards below a readable width, so a 4K monitor
 * shows one row and a 1280px laptop wraps to several — never squeezed sparklines.
 */
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import type { JSX } from "react";

import { Badge, useStatusTone } from "@/components/primitives";
import { styleFor } from "@/lib/statusStyles";

import type { FlowStageName } from "../../server/flow.js";
import type { FlowCardData } from "../../web/flowStrip.js";
import { humanizeAge } from "./WaitingOnPersonList.js";

const CARD_MIN_WIDTH = 168;

function CardSkeleton(): JSX.Element {
  return (
    <Box sx={{ flex: `1 1 ${CARD_MIN_WIDTH}px`, minWidth: CARD_MIN_WIDTH, p: 3 }}>
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="30%" height={36} />
      <Skeleton variant="rectangular" height={32} sx={{ mt: 1, borderRadius: 1 }} />
    </Box>
  );
}

interface FlowCardProps {
  readonly card: FlowCardData;
  readonly selected: boolean;
  readonly reducedMotion: boolean;
  readonly onClick: () => void;
}

function FlowCard({ card, selected, reducedMotion, onClick }: FlowCardProps): JSX.Element {
  const style = styleFor("flow", card.stage);
  const toneStyle = useStatusTone(style.tone);
  const warnStyle = useStatusTone("warn");
  const ageTone = useStatusTone(card.stuck ? "warn" : "neutral");

  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={(theme) => ({
        flex: `1 1 ${CARD_MIN_WIDTH}px`,
        minWidth: CARD_MIN_WIDTH,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 1,
        p: 3,
        borderRadius: 1,
        textAlign: "left",
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${selected ? toneStyle.color : theme.palette.divider}`,
        boxShadow: card.stuck ? `0 0 0 2px ${warnStyle.border}` : theme.shadows[selected ? 2 : 1],
        ...(reducedMotion ? {} : { transition: "box-shadow 150ms, border-color 150ms" }),
      })}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: "100%" }}>
        <Typography
          variant="mono"
          component="span"
          sx={{ fontSize: 11, letterSpacing: "0.04em", color: toneStyle.color }}
        >
          {style.icon} {style.label}
        </Typography>
        {card.heldCount > 0 ? (
          <Badge tone="err" icon="⛔" label={String(card.heldCount)} srLabel={`${card.heldCount} held`} />
        ) : null}
      </Stack>

      <Typography
        component="span"
        sx={(theme) => ({
          fontFamily: theme.typography.displayMd.fontFamily,
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.1,
        })}
      >
        {card.count}
      </Typography>

      <Box sx={{ height: 32, width: "100%" }}>
        {card.sparkline.length > 0 ? (
          <SparkLineChart
            data={[...card.sparkline]}
            height={32}
            showHighlight={!reducedMotion}
            colors={[toneStyle.color]}
            sx={{ "& .MuiAreaElement-root": { fill: toneStyle.bg } }}
          />
        ) : null}
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: ageTone.color }}>
          {humanizeAge(card.medianAgeMs)}
        </Typography>
        {card.stuck ? (
          <Typography component="span" sx={{ fontSize: 12, color: warnStyle.color }}>
            ⚠ stuck
          </Typography>
        ) : null}
      </Stack>
    </ButtonBase>
  );
}

export interface FlowStripProps {
  readonly cards: readonly FlowCardData[];
  readonly selected: FlowStageName | undefined;
  readonly onSelect: (stage: FlowStageName) => void;
  /** First load — no snapshot has ever arrived yet. */
  readonly loading?: boolean;
  /** A refetch with a previous snapshot still on screen — dims it instead of blanking. */
  readonly fetching?: boolean;
}

export function FlowStrip({ cards, selected, onSelect, loading = false, fetching = false }: FlowStripProps): JSX.Element {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        overflowX: "auto",
        ...(fetching && !loading ? { opacity: 0.5, pointerEvents: "none" } : {}),
        ...(reducedMotion ? {} : { transition: "opacity 120ms" }),
      }}
      aria-busy={loading || fetching}
    >
      {loading
        ? Array.from({ length: 9 }, (_, i) => <CardSkeleton key={i} />)
        : cards.map((card) => (
            <FlowCard
              key={card.stage}
              card={card}
              selected={card.stage === selected}
              reducedMotion={reducedMotion}
              onClick={() => onSelect(card.stage)}
            />
          ))}
    </Box>
  );
}
