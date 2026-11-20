/** The `LOOP_REPO` env var is `"owner/name"`; split it for `/api/repo`. */
export interface RepoRef {
  readonly owner: string;
  readonly name: string;
}

/** Parses `"owner/name"`. Falls back to the whole string as `name` with an
 *  empty `owner` if there is no `/` — callers always have a well-formed
 *  `LOOP_REPO` in practice, but this keeps the endpoint total rather than
 *  throwing on a misconfigured env var. */
export function parseRepo(raw: string): RepoRef {
  const slash = raw.indexOf("/");
  if (slash === -1) return { owner: "", name: raw };
  return { owner: raw.slice(0, slash), name: raw.slice(slash + 1) };
}
