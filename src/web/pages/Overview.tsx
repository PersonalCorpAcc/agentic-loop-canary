import { useEffect, useState, type ReactElement } from "react";

import { PageHeader, Section } from "@/components/layout";
import { Sparkline } from "@/components/data-display";
import { HelperText, StatTile } from "@/components/primitives";

import type { DeploymentFrequencyResult } from "../../server/metrics/deploymentFrequency.js";
import type { LeadTimeResult } from "../../server/metrics/leadTime.js";
import type { RepoRef } from "../../shared/repo.js";
import { formatDeploymentFrequencyDelta } from "../deploymentFrequency.js";
import { formatLeadTimeDays } from "../leadTime.js";

/** Root page (`/`). Lead-time (#144) and deployment-frequency (#143) stat tiles -- #139's
 *  remaining children will add more summary tiles alongside them. */
export function Overview(): ReactElement {
  const [repo, setRepo] = useState<RepoRef | null | undefined>(undefined);
  const [leadTime, setLeadTime] = useState<LeadTimeResult | null | undefined>(undefined);
  const [deploymentFrequency, setDeploymentFrequency] = useState<DeploymentFrequencyResult | null | undefined>(
    undefined,
  );

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

  useEffect(() => {
    if (repo === undefined || repo === null) return;
    const params = new URLSearchParams({ repo: `${repo.owner}/${repo.name}`, period: "" });
    fetch(`/api/deployment-frequency?${params.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<DeploymentFrequencyResult>) : null))
      .then(setDeploymentFrequency)
      .catch(() => setDeploymentFrequency(null));
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
      {deploymentFrequency ? (
        <Section title="Deployment frequency">
          <StatTile
            label="Deployment frequency"
            value={String(deploymentFrequency.total)}
            sub={
              deploymentFrequency.total === 0 ? (
                <HelperText inline>No changes merged in this period</HelperText>
              ) : (
                <>
                  <Sparkline points={deploymentFrequency.buckets.map((b) => b.count)} />
                  <HelperText inline>
                    {formatDeploymentFrequencyDelta(deploymentFrequency.total, deploymentFrequency.previousTotal)}
                  </HelperText>
                </>
              )
            }
          />
        </Section>
      ) : null}
    </>
  );
}
