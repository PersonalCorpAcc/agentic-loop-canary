/**
 * Deployment-frequency formatting helper, browser-safe (#143). The fetched
 * `DeploymentFrequencyResult` JSON already has everything a page needs computed
 * server-side -- this only turns `total`/`previousTotal` into the delta line, sidestepping
 * the divide-by-zero percentage edge case entirely rather than special-casing it.
 */

export function formatDeploymentFrequencyDelta(total: number, previousTotal: number): string {
  if (total === 0 && previousTotal === 0) return "no change";
  if (previousTotal === 0) return "no prior data";
  const delta = total - previousTotal;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs previous period`;
}
