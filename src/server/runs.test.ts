import { describe, expect, it } from "vitest";

import { routeOf, subjectOf } from "./runs.js";

/**
 * Real run titles, taken from this repository's own Actions history. The router names every
 * run it starts, and those names are the only thing the run list knows about which route a
 * run belongs to -- which is also why the loop's own guidance calls title matching a
 * pre-filter rather than a guarantee (D4).
 */
describe("reading a route out of a run title", () => {
  it.each([
    ["Working (Implement): Add IsPrerelease to the semver package (#24)", "implement"],
    ["Working (Merge Gate): PR #25", "merge-gate"],
    ["dispatch: reconcile-bot-pr-runs", "reconcile-bot-pr-runs"],
    ["dispatch: sync-stages", "sync-stages"],
  ])("reads %s as %s", (title, route) => {
    expect(routeOf({ name: "Work Router", display_title: title })).toBe(route);
  });

  it("falls back to the workflow's name when the title says nothing", () => {
    expect(routeOf({ name: "CI", display_title: "Add IsPrerelease to the semver package" })).toBe("CI");
  });

  it("finds the issue or pull request a run is about", () => {
    expect(subjectOf("Working (Merge Gate): PR #25")).toBe("#25");
    expect(subjectOf("Working (Implement): Add IsPrerelease (#24)")).toBe("#24");
    expect(subjectOf("dispatch: promote")).toBe("-");
  });
});
