import { useEffect, useState, type ReactElement } from "react";

import { PageHeader, Section } from "@/components/layout";
import { Sparkline } from "@/components/data-display";
import { StatTile } from "@/components/primitives";

import type { LeadTimeResult } from "../../server/metrics/leadTime.js";
import type { RepoRef } from "../../shared/repo.js";
import { formatLeadTimeDays } from "../leadTime.js";

/** Root page (`/`). Currently just the lead-time stat tile + sparkline (#144) -- #139's
 *  other children will add more summary tiles alongside it. */
export function Overview(): ReactElement {
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [leadTime, setLeadTime] = useState<LeadTimeResult | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/repo")
      .then((response) => response.json() as Promise<RepoRef>)
      .then(setRepo)
      .catch(() => setRepo(null));
  }, []);

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period: "" });
    fetch(`/api/lead-time?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<LeadTimeResult>) : null))
      .then(setLeadTime)
      .catch(() => setLeadTime(null));
  }, [repo]);

  return (
    <>
      <PageHeader title="Overview" />
      {leadTime ? (
        <Section title="Lead time">
          <StatTile
            label="Lead time"
            value={leadTime.medianDays === undefined ? "—" : formatLeadTimeDays(leadTime.medianDays)}
            sub={<Sparkline points={leadTime.dailyMedians.map((d) => d.medianDays)} />}
          />
        </Section>
      ) : null}
    </>
  );
}
