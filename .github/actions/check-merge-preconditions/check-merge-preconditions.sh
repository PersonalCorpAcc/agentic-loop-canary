#!/usr/bin/env bash
# Managed by @plainconceptsplatform/workflows@0.5.1. Source: loops/actions/check-merge-preconditions/check-merge-preconditions.sh. Profile digest: 588652f49de4. Update with `workflows update --force`; consumer edits may be overwritten.
#
# What the forge says about this pull request before anything tries to merge it (FR-068).
#
# A merge the forge will refuse is not an error to retry: it is a pull request that needs a
# person, and a red run says neither which pull request nor what to do about it. So the
# state is read first, and a refusal becomes a review with a sentence rather than an attempt
# with a stack trace.
#
# Writes `mergeable=` and `reason=` to $GITHUB_OUTPUT. The caller decides what to do with a
# false, because the gate and the output applier label different things.

set -euo pipefail

: "${REPO:?check-merge-preconditions: REPO is required}"
: "${PR_NUMBER:?check-merge-preconditions: PR_NUMBER is required}"
: "${MERGE_METHOD:?check-merge-preconditions: MERGE_METHOD is required}"

case "$PR_NUMBER" in
  '' | *[!0-9]*)
    echo "::error::check-merge-preconditions: '${PR_NUMBER}' is not a pull request number." >&2
    exit 1
    ;;
esac

case "$MERGE_METHOD" in
  squash | merge | rebase) ;;
  *)
    echo "::error::check-merge-preconditions: '${MERGE_METHOD}' is not a merge method. The profile decides this, and it is one of squash, merge or rebase." >&2
    exit 1
    ;;
esac

refuse() {
  {
    echo "mergeable=false"
    echo "refusal=$1"
  } >>"${GITHUB_OUTPUT:-/dev/stdout}"
  echo "PR #${PR_NUMBER} will not be merged: $1"
  exit 0
}

# GitHub computes mergeability on demand, and the first read of a pull request nobody has
# opened recently answers UNKNOWN while it works the answer out in the background. Asking
# once and believing the answer is how "not conflicting" is reported for exactly the pull
# requests that are: the router learned this twice in production.
state="UNKNOWN"
for _ in 1 2 3 4 5 6; do
  state="$(gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeStateStatus --jq '.mergeStateStatus' 2>/dev/null || echo UNKNOWN)"
  [ "$state" = "UNKNOWN" ] || break
  sleep 5
done

case "$state" in
  DIRTY)
    refuse "it conflicts with its base branch, and a conflict the gate could not resolve is a person's to resolve."
    ;;
  DRAFT)
    refuse "it is a draft, and the forge refuses to merge one."
    ;;
  BLOCKED)
    refuse "branch protection is not satisfied: a required check or a required review is missing. The gate merges what protection allows and never past it."
    ;;
  BEHIND)
    refuse "the base has moved and this repository requires branches to be up to date. Under a chain every branch is structurally behind its base and nothing here rebases to catch up, so that setting belongs off on the stages."
    ;;
  UNKNOWN)
    refuse "the forge would not say whether it can be merged, even after polling. Nothing is merged on an unknown state."
    ;;
esac

# `rebaseable` is a REST field, and it is a precondition only under rebase: under squash or
# merge the forge builds one commit and an unreplayable history is not in its way.
if [ "$MERGE_METHOD" = "rebase" ]; then
  rebaseable="$(gh api "repos/${REPO}/pulls/${PR_NUMBER}" --jq '.rebaseable // "null"' 2>/dev/null || echo null)"
  if [ "$rebaseable" = "false" ]; then
    refuse "the forge cannot replay its commits onto the base, and this repository merges by rebase."
  fi
fi

{
  echo "mergeable=true"
  echo "refusal="
} >>"${GITHUB_OUTPUT:-/dev/stdout}"
echo "PR #${PR_NUMBER} may be merged: the forge reports ${state}."
