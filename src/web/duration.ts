import type { LoopRun } from "../shared/types.js";

/** How long a run took, or that it is still going: the table's "took" column. */
export function durationLabel(run: Pick<LoopRun, "startedAt" | "finishedAt">): string {
  if (run.finishedAt === undefined) return "running";

  const elapsedMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "-";

  const totalSeconds = Math.round(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
