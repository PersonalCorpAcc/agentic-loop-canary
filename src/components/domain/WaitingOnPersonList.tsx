/**
 * WaitingOnPersonList — the Delivery page's "waiting on a person" section (#165).
 *
 * Renders `waitingRows`' output: one row per item currently waiting on a human, oldest first.
 * A row past the stuck threshold is flagged with both an icon and a warn-tone label (never
 * colour alone — AGENTS.md Rule 3 / the accessibility rule it encodes), and the question/review
 * text is a muted "no detail available" caption when the metrics cache has none to show.
 */
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";

import { HelperText, StatusText } from "@/components/primitives";

import type { WaitingRow } from "../../web/waitingOnPerson.js";

/** `1h`/`3d`-shaped age text, shared with the Overview page's work item table (#162). */
export function humanizeAge(ageMs: number): string {
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function WaitingRowView({ row }: { readonly row: WaitingRow }): ReactElement {
  return (
    <Stack direction="row" spacing={2} alignItems="baseline">
      <span>{humanizeAge(row.ageMs)}</span>
      <a href={row.url}>
        #{row.issue} {row.title}
      </a>
      {row.questionText === undefined ? (
        <HelperText inline italic>
          no detail available
        </HelperText>
      ) : (
        <span>{row.questionText}</span>
      )}
      {row.stuck ? <StatusText variant="warn">⚠ stuck</StatusText> : null}
    </Stack>
  );
}

export interface WaitingOnPersonListProps {
  readonly rows: readonly WaitingRow[];
}

export function WaitingOnPersonList({ rows }: WaitingOnPersonListProps): ReactElement {
  if (rows.length === 0) {
    return <HelperText>nothing is waiting on a person right now</HelperText>;
  }
  return (
    <Stack spacing={2}>
      {rows.map((row) => (
        <WaitingRowView key={row.issue} row={row} />
      ))}
    </Stack>
  );
}
