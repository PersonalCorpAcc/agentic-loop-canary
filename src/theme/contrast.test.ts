import { describe, expect, it } from "vitest";

import { contrastRatio, meetsAA } from "./contrast.js";
import { darkPalette } from "./palette.js";

describe("contrastRatio", () => {
  it("is 21:1 for black on white, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("is 1:1 for a colour against itself", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });
});

describe("meetsAA", () => {
  it("passes body text at 4.5:1 and fails just under it", () => {
    expect(meetsAA("#000000", "#ffffff")).toBe(true);
    expect(meetsAA("#777777", "#808080")).toBe(false);
  });

  it("accepts a lower ratio for large text", () => {
    expect(meetsAA("#949494", "#ffffff", "large")).toBe(true);
    expect(meetsAA("#949494", "#ffffff", "body")).toBe(false);
  });
});

describe("the dark palette the shell uses (#142)", () => {
  // The three text/background pairings the acceptance criteria names: page background, the
  // nav rail (ink on its raised surface), and the top bar (secondary text on the page bg).
  it("page background holds AA body-text contrast", () => {
    const { text, background } = darkPalette;
    expect(meetsAA(text!.primary!, background!.default!)).toBe(true);
    expect(meetsAA(text!.secondary!, background!.default!)).toBe(true);
  });

  it("the nav rail's ink reads against its own surface", () => {
    const { brand, surface } = darkPalette;
    expect(meetsAA(brand!.main!, surface!.raised!)).toBe(true);
  });

  it("a filled control's contrastText reads against brand.main", () => {
    const { brand } = darkPalette;
    expect(meetsAA(brand!.contrastText!, brand!.main!)).toBe(true);
  });
});
