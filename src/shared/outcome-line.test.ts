import { describe, expect, it } from "vitest";

import { outcomeOf, parseOutcomeLine } from "./outcome-line.js";

/**
 * The lines here are real: each was written by a run of the loop this application watches, on
 * 17 and 18 September 2026. A fixture invented to match the parser proves only that the
 * parser matches itself.
 */
describe("the loop's outcome line", () => {
  it("reads the four fields and the caption after them", () => {
    const parsed = parseOutcomeLine(
      "outcome=acted route=merge-gate subject=#25 reason=merge-armed -- The pull request is marked ready; the forge merges it when the rule holding it is satisfied.",
    );

    expect(parsed).toMatchObject({ outcome: "acted", route: "merge-gate", subject: "#25", reason: "merge-armed" });
    expect(parsed?.detail).toContain("marked ready");
  });

  it("keeps a detail that contains its own separators", () => {
    const parsed = parseOutcomeLine("outcome=no-action route=promote subject=- reason=soak-pending -- waited 3m of 5m -- not yet");
    expect(parsed?.detail).toBe("waited 3m of 5m -- not yet");
  });

  it("calls an outcome it does not know unknown rather than dropping the run", () => {
    // A newer loop may write a word this build has never heard of. Showing the run with an
    // unknown outcome is useful; discarding it is not.
    const parsed = parseOutcomeLine("outcome=deferred route=sync-stages subject=- reason=stages-aligned");
    expect(parsed?.outcome).toBe("unknown");
    expect(parsed?.route).toBe("sync-stages");
  });

  it("ignores a line that is not an outcome line", () => {
    expect(parseOutcomeLine("Run actions/checkout@v7")).toBeUndefined();
    expect(parseOutcomeLine("")).toBeUndefined();
  });

  it("finds the outcome inside a log of everything else", () => {
    const log = [
      "##[group]Run bash record-outcome.sh",
      "shell: /usr/bin/bash",
      "##[endgroup]",
      "outcome=handed-to-human route=merge-gate subject=#4 reason=review-requested -- The gate asked for a human.",
      "##[end-action]",
    ].join("\n");

    expect(outcomeOf(log)).toMatchObject({ outcome: "handed-to-human", reason: "review-requested" });
  });
});
