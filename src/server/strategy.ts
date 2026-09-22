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

/**
 * The stages a change is promoted through, in the order `promote-change` walks them: the
 * same array `is_stage_branch` in this file checks a merge's base against. One entry under
 * a strategy with no chain -- the branch every change is cut from and merged back into.
 */
const stageBranchesPattern = /^\s*readonly\s+STAGE_BRANCHES=\(([^)]*)\)\s*$/m;

export function readStageBranches(classifyRoutePath: string): string[] | undefined {
  const contents = readFileSync(classifyRoutePath, "utf8");
  const match = stageBranchesPattern.exec(contents);
  if (match === null) return undefined;
  return [...match[1]!.matchAll(/"([^"]*)"/g)].map((entry) => entry[1]!);
}
