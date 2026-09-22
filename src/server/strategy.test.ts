import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readBranchStrategy, readStageBranches } from "./strategy.js";

describe("reading the branching strategy out of the installed classifier", () => {
  it("reads the constant this repository actually has installed", () => {
    const classifyRoute = fileURLToPath(
      new URL("../../.github/actions/classify-route/classify-route.sh", import.meta.url),
    );
    expect(readBranchStrategy(classifyRoute)).toBe("env-promotion");
  });

  it("reads whichever strategy a different profile installed", () => {
    const dir = mkdtempSync(join(tmpdir(), "strategy-"));
    const file = join(dir, "classify-route.sh");
    writeFileSync(
      file,
      ["#!/usr/bin/env bash", "readonly STAGE_BRANCHES=(\"main\")", 'readonly BRANCH_STRATEGY="trunk"', ""].join("\n"),
    );
    expect(readBranchStrategy(file)).toBe("trunk");
  });

  it("is undefined when the file carries no such constant", () => {
    const dir = mkdtempSync(join(tmpdir(), "strategy-"));
    const file = join(dir, "classify-route.sh");
    writeFileSync(file, "#!/usr/bin/env bash\necho hi\n");
    expect(readBranchStrategy(file)).toBeUndefined();
  });
});

describe("reading the stage chain out of the installed classifier", () => {
  it("reads the chain this repository actually has installed", () => {
    const classifyRoute = fileURLToPath(
      new URL("../../.github/actions/classify-route/classify-route.sh", import.meta.url),
    );
    expect(readStageBranches(classifyRoute)).toEqual(["dev", "test", "main"]);
  });

  it("reads whichever chain a different profile installed", () => {
    const dir = mkdtempSync(join(tmpdir(), "strategy-"));
    const file = join(dir, "classify-route.sh");
    writeFileSync(file, ["#!/usr/bin/env bash", 'readonly STAGE_BRANCHES=("main")', ""].join("\n"));
    expect(readStageBranches(file)).toEqual(["main"]);
  });

  it("is undefined when the file carries no such constant", () => {
    const dir = mkdtempSync(join(tmpdir(), "strategy-"));
    const file = join(dir, "classify-route.sh");
    writeFileSync(file, "#!/usr/bin/env bash\necho hi\n");
    expect(readStageBranches(file)).toBeUndefined();
  });
});
