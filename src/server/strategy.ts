import { readFileSync } from "node:fs";

/**
 * The branching strategy an installation runs, read out of the classifier it installed
 * rather than restated here: a reprofile changes the constant in that file, and this then
 * answers differently with no code edit.
 */
const declarationPattern = /^\s*readonly\s+BRANCH_STRATEGY="([^"]*)"\s*$/m;

export function readBranchStrategy(classifyRoutePath: string): string | undefined {
  const contents = readFileSync(classifyRoutePath, "utf8");
  return declarationPattern.exec(contents)?.[1];
}
