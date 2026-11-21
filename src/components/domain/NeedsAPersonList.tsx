/**
 * NeedsAPersonList — the "needs a person" list (#141): every currently stuck change, across
 * every Changes-board column, oldest first. Shared between the Changes board itself and the
 * Overview page (AGENTS.md Rule 4: a shared container needs ≥2 real call sites).
 */
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";

import { HelperText, StatusText } from "@/components/primitives";

import type { ChangeCard } from "../../server/changes.js";

function humanizeAge(ageMs: number): string {
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export interface NeedsAPersonListProps {
  readonly cards: readonly ChangeCard[];
}

export function NeedsAPersonList({ cards }: NeedsAPersonListProps): ReactElement {
  if (cards.length === 0) {
    return <HelperText>nothing needs a person right now</HelperText>;
  }
  return (
    <Stack spacing={2}>
      {cards.map((card) => (
        <Stack key={card.issue} direction="row" spacing={2} alignItems="baseline">
          <span>{humanizeAge(card.ageMs)}</span>
          <a href={card.url}>
            #{card.issue} {card.title}
          </a>
          <StatusText variant="warn">⚠ stuck</StatusText>
        </Stack>
      ))}
    </Stack>
  );
}
