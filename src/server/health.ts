/**
 * Whether polling is healthy enough to trust, from what each poll reports back.
 *
 * A single failed poll is a blip -- a network hiccup, a moment of GitHub flakiness -- and
 * flagging the dashboard degraded on the first one would cry wolf. Several in a row, or the
 * forge telling us we're about to run out of quota, is the real signal this exists to catch.
 * Rate-limited and merely-failed polls are not distinguished in the result: both mean the
 * data on screen might be going stale, which is the one thing a viewer needs to know.
 */

const CONSECUTIVE_FAILURES_TO_DEGRADE = 3;
const LOW_REMAINING_QUOTA = 1;

export class HealthTracker {
  #consecutiveFailures = 0;
  #degraded = false;

  get degraded(): boolean {
    return this.#degraded;
  }

  /** Call after a poll fails for any reason. Returns whether `degraded` changed. */
  recordFailure(): boolean {
    this.#consecutiveFailures += 1;
    return this.#set(this.#consecutiveFailures >= CONSECUTIVE_FAILURES_TO_DEGRADE);
  }

  /** Call after a poll succeeds. Returns whether `degraded` changed. */
  recordSuccess(rateLimitRemaining: number | null): boolean {
    this.#consecutiveFailures = 0;
    // Warn ahead of the 403 rather than after it, when the forge tells us quota is nearly gone.
    return this.#set(rateLimitRemaining !== null && rateLimitRemaining <= LOW_REMAINING_QUOTA);
  }

  #set(degraded: boolean): boolean {
    const changed = degraded !== this.#degraded;
    this.#degraded = degraded;
    return changed;
  }
}
