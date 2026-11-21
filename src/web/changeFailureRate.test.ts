import { describe, expect, it } from "vitest";

import { formatChangeFailureRateDelta, formatChangeFailureRatePercent } from "./changeFailureRate.js";

describe("formatChangeFailureRatePercent", () => {
  it("renders a whole percent", () => {
    expect(formatChangeFailureRatePercent(0.25)).toBe("25%");
  });

  it("rounds to the nearest whole percent", () => {
    expect(formatChangeFailureRatePercent(1 / 3)).toBe("33%");
  });

  it("is 0% for a zero rate", () => {
    expect(formatChangeFailureRatePercent(0)).toBe("0%");
  });
});

describe("formatChangeFailureRateDelta", () => {
  it("is 'no changes shipped in this period' when nothing shipped", () => {
    expect(formatChangeFailureRateDelta(0, 5, 0, 0.4)).toBe("no changes shipped in this period");
  });

  it("is 'no prior data' when the previous period shipped nothing", () => {
    expect(formatChangeFailureRateDelta(4, 0, 0.25, 0)).toBe("no prior data");
  });

  it("is 'no change vs previous period' when the rounded rate is unchanged", () => {
    expect(formatChangeFailureRateDelta(4, 4, 0.25, 0.25)).toBe("no change vs previous period");
  });

  it("renders a positive percentage-point delta", () => {
    expect(formatChangeFailureRateDelta(4, 4, 0.5, 0.25)).toBe("+25pp vs previous period");
  });

  it("renders a negative percentage-point delta", () => {
    expect(formatChangeFailureRateDelta(4, 4, 0.25, 0.5)).toBe("-25pp vs previous period");
  });
});
