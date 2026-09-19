import { describe, expect, it } from "vitest";

// Deliberately failing, to observe what the merge gate does with a red run on a
// bot pull request under protection (T237's matrix). Remove once observed.
describe("the red CI probe", () => {
  it("fails on purpose", () => {
    expect(1).toBe(2);
  });
});
