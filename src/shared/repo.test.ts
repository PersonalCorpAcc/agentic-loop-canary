import { describe, expect, it } from "vitest";

import { parseRepo } from "./repo.js";

describe("parseRepo", () => {
  it("splits owner/name on the first slash", () => {
    expect(parseRepo("PersonalCorpAcc/agentic-loop-canary")).toEqual({
      owner: "PersonalCorpAcc",
      name: "agentic-loop-canary",
    });
  });

  it("keeps only the first segment as owner when there are extra slashes", () => {
    expect(parseRepo("owner/name/extra")).toEqual({ owner: "owner", name: "name/extra" });
  });

  it("falls back to an empty owner when there is no slash", () => {
    expect(parseRepo("just-a-name")).toEqual({ owner: "", name: "just-a-name" });
  });
});
