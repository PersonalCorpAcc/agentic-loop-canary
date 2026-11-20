import { useEffect, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";

import { PageHeader, Section } from "@/components/layout";
import { TimeInStageBar, WaitingOnPersonList } from "@/components/domain";

import type { FlowResult } from "../../server/flow.js";
import type { RepoRef } from "../../shared/repo.js";
import { shippedInPeriod, timeInStageRows } from "../timeInStageBar.js";
import { waitingRows } from "../waitingOnPerson.js";

/** `/delivery` page (#165): "where time goes" (a stacked bar per shipped item, or an averaged
 *  one) and "who do I need to go ask" (the waiting-on-a-person list), both built off the same
 *  cached `/api/flow` snapshot the Overview page's CFD also reads. */
export function Delivery(): ReactElement {
  const [searchParams] = useSearchParams();
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [flow, setFlow] = useState<FlowResult | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const period = searchParams.get("period") ?? "";
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period });
    fetch(`/api/flow?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<FlowResult>) : null))
      .then(setFlow)
      .catch(() => setFlow(null));
  }, [repo, searchParams]);

  return (
    <>
      <PageHeader title="Delivery" />
      {flow ? (
        <Stack spacing={4}>
          <Section title="Where time goes">
            <TimeInStageBar result={timeInStageRows(shippedInPeriod(flow.items, flow.from, flow.to))} />
          </Section>
          <Section title="Waiting on a person">
            <WaitingOnPersonList rows={waitingRows(flow.items, new Date(flow.to))} />
          </Section>
        </Stack>
      ) : null}
    </>
  );
}
