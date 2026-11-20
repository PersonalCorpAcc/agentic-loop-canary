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

/**
 * How long a change rests on the previous stage before the named stage takes it, read out of
 * `promote-change/action.yml`'s `soak:` input default rather than restated here -- the same
 * way `readStageBranches` above reads a compiled shell constant instead of invoking a YAML
 * parser. The default is `stage=duration` pairs (`main=5m,test=5m`), keyed by the stage a
 * change is soaking *into*, matching `promote-change.sh`'s own `soak_for`.
 */
const soakDefaultPattern = /soak:\s*\n(?:[^\n]*\n)*?\s*default:\s*'([^']*)'/;
const durationPattern = /^(\d+)([mhd])$/;

function durationSeconds(value: string): number | undefined {
  const match = durationPattern.exec(value);
  if (match === null) return undefined;
  const perUnit = { m: 60, h: 3600, d: 86400 }[match[2]!]!;
  return Number(match[1]) * perUnit;
}

/** `undefined` when the `soak:` input or its default is missing, or any pair fails to parse --
 *  the same convention as `readStageBranches` -- so a future compiler change degrades the
 *  pipeline graphic to showing no timers rather than crashing the endpoint. */
export function soakOf(actionYmlPath: string): Record<string, number> | undefined {
  const contents = readFileSync(actionYmlPath, "utf8");
  const match = soakDefaultPattern.exec(contents);
  if (match === null) return undefined;

  const pairs = match[1]!
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (pairs.length === 0) return undefined;

  const result: Record<string, number> = {};
  for (const pair of pairs) {
    const [stage, duration] = pair.split("=");
    if (stage === undefined || duration === undefined) return undefined;
    const seconds = durationSeconds(duration);
    if (seconds === undefined) return undefined;
    result[stage] = seconds;
  }
  return result;
}
