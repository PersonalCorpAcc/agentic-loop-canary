import { describe, expect, it } from "vitest";

import { DEFAULT_PERIOD, parsePeriod } from "./period.js";

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
