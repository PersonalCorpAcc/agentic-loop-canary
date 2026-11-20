import { describe, expect, it } from "vitest";

import { formatLeadTimeDays } from "./leadTime.js";

describe("formatLeadTimeDays", () => {
  it("renders zero as a one-decimal duration", () => {
    expect(formatLeadTimeDays(0)).toBe("0.0d");
  });

  it("rounds down to one decimal place", () => {
    expect(formatLeadTimeDays(2.34)).toBe("2.3d");
  });

  it("rounds up at the one-decimal boundary", () => {
    expect(formatLeadTimeDays(2.35)).toBe("2.4d");
  });
});
