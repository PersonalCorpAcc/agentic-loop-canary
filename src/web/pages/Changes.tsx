import { useEffect, useState, type ReactElement } from "react";
import Stack from "@mui/material/Stack";

import { PageHeader, Section } from "@/components/layout";
import { BoardColumn, NeedsAPersonList } from "@/components/domain";

import type { ChangesBoard } from "../../server/changes.js";
import type { RepoRef } from "../../shared/repo.js";

/** `/changes` page (#141): one column per change state -- Implementing, In review, each
 *  configured chain stage oldest-first, Held -- plus a "needs a person" list of every change
 *  currently past its column's stuck threshold, read off the same cached `/api/changes`
 *  snapshot the Overview page's own needs-a-person list reads. */
export function Changes(): ReactElement {
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [board, setBoard] = useState<ChangesBoard | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}` });
    fetch(`/api/changes?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<ChangesBoard>) : null))
      .then(setBoard)
      .catch(() => setBoard(null));
  }, [repo]);

  return (
    <>
      <PageHeader title="Changes" />
      {board ? (
        <Stack spacing={4}>
          <Section title="Needs a person">
            <NeedsAPersonList cards={board.stuck} />
          </Section>
          <Stack direction="row" spacing={4} sx={{ overflowX: "auto" }}>
            {board.columns.map((column) => (
              <BoardColumn key={column.key} column={column} />
            ))}
          </Stack>
        </Stack>
      ) : null}
    </>
  );
}
