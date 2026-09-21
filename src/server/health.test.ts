import { describe, expect, it } from "vitest";

import { HealthTracker } from "./health.js";

describe("tracking whether polling is healthy", () => {
  it("stays healthy through an occasional failure", () => {
    const health = new HealthTracker();
    expect(health.recordFailure()).toBe(false);
    expect(health.recordFailure()).toBe(false);
    expect(health.degraded).toBe(false);
  });

  it("flags degraded once failures pile up", () => {
    const health = new HealthTracker();
    health.recordFailure();
    health.recordFailure();
    expect(health.recordFailure()).toBe(true);
    expect(health.degraded).toBe(true);
  });

  it("clears degraded on the next success", () => {
    const health = new HealthTracker();
    health.recordFailure();
    health.recordFailure();
    health.recordFailure();
    expect(health.degraded).toBe(true);
    expect(health.recordSuccess(null)).toBe(true);
    expect(health.degraded).toBe(false);
  });

  it("warns ahead of the 403 when quota is nearly gone", () => {
    const health = new HealthTracker();
    expect(health.recordSuccess(1)).toBe(true);
    expect(health.degraded).toBe(true);
    expect(health.recordSuccess(59)).toBe(true);
    expect(health.degraded).toBe(false);
  });

  it("does not flag on a success with plenty of quota left", () => {
    const health = new HealthTracker();
    expect(health.recordSuccess(59)).toBe(false);
    expect(health.degraded).toBe(false);
  });

  it("reports no change when degraded state is unchanged", () => {
    const health = new HealthTracker();
    health.recordFailure();
    expect(health.recordSuccess(59)).toBe(false);
  });
});
