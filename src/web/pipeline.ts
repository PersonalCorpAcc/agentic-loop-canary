/**
 * Pure helpers for the pipeline graphic's soak countdown (issue #166), kept free of any
 * rendering call the same way `loopTable.ts` keeps its table mapping -- so the arithmetic
 * tests by calling the functions directly, never by mounting `App`.
 */

/** The soak remaining right now: `remainingSecondsAtFetch` (as the server computed it when
 *  `/api/stages` last answered, at `fetchedAt`) aged by how long it has been since, floored
 *  at zero the same way the server already floors its own figure. This is what lets the
 *  countdown tick between the 30s polls that refresh `stages`, without a request per tick. */
export function liveRemainingSeconds(remainingSecondsAtFetch: number, fetchedAt: number, now: number): number {
  const agedSeconds = Math.floor((now - fetchedAt) / 1000);
  return Math.max(0, remainingSecondsAtFetch - agedSeconds);
}

/** `m:ss`, or `h:mm:ss` past an hour -- a countdown a person reads at a glance, not a
 *  duration they do arithmetic on. */
export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
