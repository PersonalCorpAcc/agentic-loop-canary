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
  it("returns the exact preceding 30 days for period=30d, not overlapping the current window", () => {
    const to = new Date("2026-03-31T00:00:00Z");
    const window = previousPeriodWindow("30d", to);
    expect(window).toEqual({ from: "2026-01-30T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z" });
  });

  it("returns the exact preceding 7 days for period=7d", () => {
    const to = new Date("2026-03-31T00:00:00Z");
    const window = previousPeriodWindow("7d", to);
    expect(window).toEqual({ from: "2026-03-17T00:00:00.000Z", to: "2026-03-24T00:00:00.000Z" });
  });

  it("returns the exact preceding 90 days for period=90d", () => {
    const to = new Date("2026-03-31T00:00:00Z");
    const window = previousPeriodWindow("90d", to);
    expect(window).toEqual({ from: "2025-10-02T00:00:00.000Z", to: "2025-12-31T00:00:00.000Z" });
  });
});
