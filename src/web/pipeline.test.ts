import { describe, expect, it } from "vitest";

import { formatCountdown, liveRemainingSeconds } from "./pipeline.js";

describe("live remaining soak time", () => {
  it("matches the server's figure right at fetch time", () => {
    expect(liveRemainingSeconds(180, 1_000, 1_000)).toBe(180);
  });

  it("ages the server's figure by time elapsed since the fetch", () => {
    expect(liveRemainingSeconds(180, 1_000, 1_000 + 45_000)).toBe(135);
  });

  it("floors at zero rather than going negative once the soak completes", () => {
    expect(liveRemainingSeconds(10, 1_000, 1_000 + 20_000)).toBe(0);
  });
});

describe("countdown formatting", () => {
  it("renders under an hour as m:ss", () => {
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("renders an hour or more as h:mm:ss", () => {
    expect(formatCountdown(3_725)).toBe("1:02:05");
  });
});
