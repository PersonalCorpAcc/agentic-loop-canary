/**
 * ChangeCard — one Changes-board card (#141): a change's issue, its open pull request when
 * it has one, and how long it has sat in its current state. A card past its column's
 * threshold is flagged with colour, an icon and a text label (AGENTS.md Rule 3), never
 * colour alone, the same convention `WaitingOnPersonList` already uses.
 */
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";

import { Section } from "@/components/layout";
import { StatusText } from "@/components/primitives";

import type { ChangeCard as ChangeCardData } from "../../server/changes.js";

function humanizeAge(ageMs: number): string {
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export interface ChangeCardProps {
  readonly card: ChangeCardData;
}

export function ChangeCard({ card }: ChangeCardProps): ReactElement {
  return (
    <Section variant="muted" dense>
      <Stack spacing={1}>
        <a href={card.url}>
          #{card.issue} {card.title}
        </a>
        {card.pullRequest !== undefined ? (
          <a href={card.pullRequest.url}>PR #{card.pullRequest.number}</a>
        ) : null}
        <Stack direction="row" spacing={2} alignItems="baseline">
          <span>{humanizeAge(card.ageMs)}</span>
          {card.stuck ? <StatusText variant="warn">⚠ stuck</StatusText> : null}
        </Stack>
      </Stack>
    </Section>
  );
}
