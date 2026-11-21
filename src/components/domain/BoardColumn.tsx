/**
 * BoardColumn — one Changes-board column (#141): a label, and every card currently
 * classified into it. An empty column shows a calm "nothing here" message rather than a
 * blank gap indistinguishable from a loading state.
 */
import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";

import { Eyebrow, HelperText } from "@/components/primitives";

import type { ChangeColumn } from "../../server/changes.js";
import { ChangeCard } from "./ChangeCard";

export interface BoardColumnProps {
  readonly column: ChangeColumn;
}

export function BoardColumn({ column }: BoardColumnProps): ReactElement {
  return (
    <Stack spacing={2} sx={{ minWidth: 260, flex: 1 }}>
      <Eyebrow>{column.label}</Eyebrow>
      {column.cards.length === 0 ? (
        <HelperText>nothing here</HelperText>
      ) : (
        <Stack spacing={2}>
          {column.cards.map((card) => (
            <ChangeCard key={card.issue} card={card} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
