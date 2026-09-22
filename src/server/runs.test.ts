import { describe, expect, it } from "vitest";

import { carriedIssuesOf, isPromotionPullRequestBody, pullRequestNumberOf, routeOf, subjectOf } from "./runs.js";

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

/**
 * Under `env-promotion` a promotion pull request's head is a snapshot of the stage below, so
 * its body names every issue that landed there since the last promotion, not just one
 * (#96). These read the same marker grammar `resolve-pr-issue.sh` reads.
 */
describe("a run's pull request number", () => {
  it("reads it for the routes classify-route gives a pr-number", () => {
    expect(pullRequestNumberOf({ route: "merge-gate", subject: "#25" })).toBe(25);
    expect(pullRequestNumberOf({ route: "stage-merge", subject: "#73" })).toBe(73);
  });

  it("is undefined for an issue-only route, or a run with no subject", () => {
    expect(pullRequestNumberOf({ route: "implement", subject: "#25" })).toBeUndefined();
    expect(pullRequestNumberOf({ route: "merge-gate", subject: "-" })).toBeUndefined();
  });
});

describe("telling a promotion pull request's body from an ordinary one", () => {
  it("is true for both promote-change shapes", () => {
    expect(isPromotionPullRequestBody(
      "Promotes the change from `dev` to `test`.\n\n<!-- implement-issue: 47 -->\n<!-- promotion-pr: test: 40 -->",
    )).toBe(true);
    expect(isPromotionPullRequestBody(
      "Promotes `dev` to `test` as of `abc1234`.\n\n<!-- implement-issue: 47 -->\n<!-- implement-issue: 52 -->\n<!-- promotion-pr: test: 40 -->\n<!-- promotion-snapshot: test: abc1234 -->",
    )).toBe(true);
  });

  it("is false for an ordinary implement pull request, which carries one implement-issue marker of its own", () => {
    expect(isPromotionPullRequestBody("Adds a thing.\n\n<!-- implement-issue: 47 -->")).toBe(false);
  });
});

describe("the issues a promotion pull request's body carries", () => {
  it("reads every marker, oldest first and each once", () => {
    const body = "It carries 2 issue(s): #47 #52\n"
      + "<!-- implement-issue: 47 -->\n<!-- implement-issue: 52 -->\n<!-- implement-issue: 47 -->\n"
      + "<!-- promotion-pr: test: 40 -->";
    expect(carriedIssuesOf(body)).toEqual([47, 52]);
  });

  it("is empty for a body with no marker", () => {
    expect(carriedIssuesOf("Adds a thing.")).toEqual([]);
  });
});
