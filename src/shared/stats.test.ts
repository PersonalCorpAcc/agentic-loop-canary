import { describe, expect, it } from "vitest";

import { median, percentile } from "./stats.js";

describe("median", () => {
  it("returns the middle value for an odd-length set", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length set", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("computes on a set smaller than 5 values, no special-cased minimum", () => {
    expect(median([10, 20])).toBe(15);
  });
});

describe("percentile", () => {
  it("computes the 85th percentile over a fixed set", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 85)).toBeCloseTo(8.65, 5);
  });

  it("computes on a set smaller than 5 values, no special-cased minimum", () => {
    expect(percentile([10, 20, 30], 85)).toBeCloseTo(27, 5);
  });

  it("returns the single value for a one-item set", () => {
    expect(percentile([42], 85)).toBe(42);
  });

  it("returns NaN for an empty set", () => {
    expect(percentile([], 85)).toBeNaN();
  });
});
