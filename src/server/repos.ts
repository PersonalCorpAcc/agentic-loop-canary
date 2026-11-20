/**
 * The repositories the loop is configured to read.
 *
 * `LOOP_REPOS` replaces the single `LOOP_REPO` env var: a comma-separated list, trimmed and
 * deduplicated, so a trailing comma or repeated entry in Railway's config is not a second
 * fetch of the same repository. Unset falls back to the one repository this canary always
 * read, exactly as `LOOP_REPO`'s fallback did.
 */

const DEFAULT_REPO = "PersonalCorpAcc/agentic-loop-canary";

export function reposOf(env: string | undefined = process.env["LOOP_REPOS"]): string[] {
  const entries = (env ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  return entries.length === 0 ? [DEFAULT_REPO] : [...new Set(entries)];
}
