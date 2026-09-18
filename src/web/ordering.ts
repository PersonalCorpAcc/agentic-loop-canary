import type { LoopRun } from "../shared/types.js";
import { needsAttention } from "../shared/types.js";

/** Attention first, then unfinished, then newest. */
export function compareRuns(a: LoopRun, b: LoopRun): number {
  if (needsAttention(a) !== needsAttention(b)) return needsAttention(a) ? -1 : 1;
  const running = (run: LoopRun): boolean => run.finishedAt === undefined;
  if (running(a) !== running(b)) return running(a) ? -1 : 1;
  return b.startedAt.localeCompare(a.startedAt);
}
