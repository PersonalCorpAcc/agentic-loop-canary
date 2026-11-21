import { describe, expect, it } from "vitest";

import { formatDeploymentFrequencyDelta } from "./deploymentFrequency.js";

describe("formatDeploymentFrequencyDelta", () => {
  it("is 'no prior data' when the previous period had zero merges", () => {
    expect(formatDeploymentFrequencyDelta(3, 0)).toBe("no prior data");
  });

  it("is 'no change' when both periods had zero merges", () => {
    expect(formatDeploymentFrequencyDelta(0, 0)).toBe("no change");
  });

  it("renders a positive delta against the previous period", () => {
    expect(formatDeploymentFrequencyDelta(5, 2)).toBe("+3 vs previous period");
  });

  it("renders a negative delta against the previous period", () => {
    expect(formatDeploymentFrequencyDelta(2, 5)).toBe("-3 vs previous period");
  });
});
