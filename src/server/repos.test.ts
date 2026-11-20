import { describe, expect, it } from "vitest";

import { reposOf } from "./repos.js";

describe("the repositories LOOP_REPOS configures", () => {
  it("comma-splits and trims each entry", () => {
    expect(reposOf("a/one, a/two ,a/three")).toEqual(["a/one", "a/two", "a/three"]);
  });

  it("drops blank entries, including a trailing comma", () => {
    expect(reposOf("a/one,,a/two,")).toEqual(["a/one", "a/two"]);
  });

  it("deduplicates repeated entries", () => {
    expect(reposOf("a/one,a/two,a/one")).toEqual(["a/one", "a/two"]);
  });

  it("falls back to the single default repository when unset", () => {
    expect(reposOf(undefined)).toEqual(["PersonalCorpAcc/agentic-loop-canary"]);
  });

  it("falls back the same way for an empty string", () => {
    expect(reposOf("")).toEqual(["PersonalCorpAcc/agentic-loop-canary"]);
  });
});
