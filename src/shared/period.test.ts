import { describe, expect, it } from "vitest";

import { DEFAULT_PERIOD, parsePeriod, previousPeriodWindow } from "./period.js";

describe("parsePeriod", () => {
  it("accepts each known period", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("30d")).toBe("30d");
    expect(parsePeriod("90d")).toBe("90d");
  });

  it("defaults to 30 days when the URL carries no period", () => {
    expect(parsePeriod(null)).toBe(DEFAULT_PERIOD);
  });

  it("defaults to 30 days for a value that isn't one of the known periods", () => {
    expect(parsePeriod("beyond-thunderdome")).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("")).toBe(DEFAULT_PERIOD);
  });
});

describe("previousPeriodWindow", () => {
  it("is exactly the preceding 30 days for period=30d and a fixed now", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const window = previousPeriodWindow("30d", now);
    expect(window.to).toBe("2026-01-30T00:00:00.000Z");
    expect(window.from).toBe("2025-12-31T00:00:00.000Z");
  });

  it("does not overlap the current window", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const currentFrom = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const window = previousPeriodWindow("30d", now);
    expect(window.to).toBe(currentFrom);
  });

  it("scales with the period's own length", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    expect(previousPeriodWindow("7d", now).to).toBe(previousPeriodWindow("7d", now).to);
    const sevenDay = previousPeriodWindow("7d", now);
    expect(new Date(sevenDay.to).getTime() - new Date(sevenDay.from).getTime()).toBe(7 * 86_400_000);
    const ninetyDay = previousPeriodWindow("90d", now);
    expect(new Date(ninetyDay.to).getTime() - new Date(ninetyDay.from).getTime()).toBe(90 * 86_400_000);
  });
});
