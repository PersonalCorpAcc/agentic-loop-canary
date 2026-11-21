import { describe, expect, it } from "vitest";

import { formatTimeToRestoreDays, formatTimeToRestoreDelta } from "./timeToRestore.js";

describe("formatTimeToRestoreDays", () => {
  it("renders one decimal place", () => {
    expect(formatTimeToRestoreDays(2.3)).toBe("2.3d");
  });

  it("renders a whole number with a trailing .0", () => {
    expect(formatTimeToRestoreDays(3)).toBe("3.0d");
  });
});

describe("formatTimeToRestoreDelta", () => {
  it("is 'no incidents resolved in this period' when nothing cleared", () => {
    expect(formatTimeToRestoreDelta(0, 3, 0, 2)).toBe("no incidents resolved in this period");
  });

  it("is 'no prior data' when the previous period had no samples", () => {
    expect(formatTimeToRestoreDelta(2, 0, 1.5, 0)).toBe("no prior data");
  });

  it("is 'no change vs previous period' when the average is unchanged", () => {
    expect(formatTimeToRestoreDelta(2, 2, 1.5, 1.5)).toBe("no change vs previous period");
  });

  it("renders a positive delta against the previous period", () => {
    expect(formatTimeToRestoreDelta(2, 2, 3, 1)).toBe("+2.0d vs previous period");
  });

  it("renders a negative delta against the previous period", () => {
    expect(formatTimeToRestoreDelta(2, 2, 1, 3)).toBe("-2.0d vs previous period");
  });
});
