#!/usr/bin/env bash
# Managed by @plainconceptsplatform/workflows@0.5.1. Source: loops/actions/sync-stages/sync-stages.sh. Profile digest: 76d2155c1f82. Update with `workflows update --force`; consumer edits may be overwritten.
#
# Carry a change that arrived on a later stage back down the chain (FR-079).
#
# The promotion route walks the chain upward, and everything that goes up arrives that way.
# Nothing went the other direction: a hotfix committed to `main`, an administrative or
# configuration push, a revert applied where the damage was, all of them land on a later
# stage and never reach the earlier ones. `promote-change.sh` already reads the hotfix label
# and says "it takes its own path"; this file is that path.
#
# The symptom is indirect and expensive, which is why it needs a route rather than a note in
# a runbook. Under a rebase promotion the stages diverge permanently by design -- the same
# change carries a different sha on each stage -- so ancestry cannot answer "is `dev` behind
# `main`". When the earlier stage falls behind, the next pull request into it carries the
# whole delta; that trips the protected-files rule; that skips the model entirely; and the
# result is a green run that proved nothing. It cost three inconclusive gating tests on
# 17/09/2026 before the cause was found three steps upstream.
#
# Two rules keep it safe, and neither is optional:
#
#   * Downward only. The earlier stage being **ahead** with work that has not been promoted
#     yet is the normal state of a chain, and this route must never disturb it. Nothing here
#     writes, rewrites or reads back from the later stage at all.
#   * By content, never by ancestry. Both directions have to be able to be true at once --
#     `dev` ahead by un-promoted work and behind by a hotfix -- which is exactly what a
#     patch-id comparison allows and an ancestry check cannot express.
#
# And never a direct push: what is missing arrives as a pull request, so it gets CI, the
# merge gate and the same policy as anything else, and `guard-branch-write` stays the only
# thing that writes a stage.

set -euo pipefail

: "${REPO:?sync-stages: REPO is required}"
: "${STAGE_BRANCHES:?sync-stages: STAGE_BRANCHES is required}"

opened=0
reason="stages-aligned"

note() { echo "$*"; }

# One run looks at every pair in the chain, so it collects several answers and reports one
# (FR-058). A pull request that was opened outweighs anything skipped afterwards; among the
# skips the ranking is how much each wants a person, because letting the last one win hides
# the ones that do.
skipped_because() {
  local candidate="$1" entry
  [ "$opened" -eq 0 ] || return 0
  for entry in conflict-handed-off already-present stages-aligned; do
    case "$entry" in
      "$candidate") reason="$candidate"; return 0 ;;
      "$reason") return 0 ;;
    esac
  done
}

finish() {
  {
    echo "opened=${opened}"
    echo "reason=${reason}"
  } >>"${GITHUB_OUTPUT:-/dev/stdout}"
  note "Synchronisation pull requests opened: ${opened}."
  exit 0
}

IFS=',' read -r -a stages <<<"$STAGE_BRANCHES"
if [ "${#stages[@]}" -lt 2 ]; then
  note "This repository merges into one branch, so no stage can fall behind another."
  finish
fi

# env-promotion's later stages are snapshots of the branch before them rather than histories
# of their own, so "content the earlier stage is missing" is not a question about commits
# there. Promotion does not build that path either (T169); neither does this.
if [ "${BRANCH_STRATEGY:-}" = "env-promotion" ]; then
  note "This repository promotes by snapshotting the previous stage, so a stage cannot hold content another one is missing."
  finish
fi

# Every commit reachable from a ref, as patch-ids. The same code and the same reason as
# promote-change.sh: a patch-id is the content, so a change that travelled up the chain
# under a rebase answers the same on both stages even though its sha does not. A comparison
# by sha would report every promoted change as missing, and this route would carry the whole
# chain back down on its first run.
patch_ids_of() {
  local ref="$1" limit="${2:-${HISTORY_LIMIT:-200}}" sha
  git log --format=%H "$ref" 2>/dev/null | head -n "$limit" | while read -r sha; do
    git show "$sha" 2>/dev/null | git patch-id --stable 2>/dev/null | cut -d' ' -f1
  done
}

# From the top down: `main` to `test`, then `test` to `dev`. In that order because a hotfix
# on `main` belongs on every stage below it, and doing the top pair first means the run that
# carries it into `test` leaves it visible to the next run's `test` → `dev` comparison.
for (( index=${#stages[@]} - 1; index > 0; index-- )); do
  later="${stages[index]}"
  earlier="${stages[index - 1]}"

  note "── ${later} → ${earlier} ─────────────────────────────────────────"

  git fetch --no-tags origin "${later}:refs/remotes/origin/${later}" "${earlier}:refs/remotes/origin/${earlier}" >/dev/null 2>&1 || true

  if ! git rev-parse --verify --quiet "refs/remotes/origin/${later}" >/dev/null ||
    ! git rev-parse --verify --quiet "refs/remotes/origin/${earlier}" >/dev/null; then
    note "::warning::One of ${later} and ${earlier} does not exist on the remote; nothing to compare."
    continue
  fi

  # One open synchronisation per target, for the same reason promotion allows one: two pull
  # requests into the same stage are built on the same tip, and whichever merges second
  # carries content the first never saw. Matched on a marker only this route writes.
  open_sync="$(gh pr list --repo "$REPO" --state open --base "$earlier" --json number,body \
    --jq "[.[] | select((.body // \"\") | contains(\"<!-- sync-pr: ${earlier}: \"))][0].number // empty")"
  if [ -n "$open_sync" ]; then
    note "Pull request #${open_sync} is already carrying content into ${earlier}; nothing else goes there until it lands."
    skipped_because "already-present"
    continue
  fi

  # Reachable from the later stage and not from the earlier one, oldest first, merges
  # excluded: a merge commit joins two histories the earlier stage does not have, and
  # cherry-picking one is not a thing that can succeed.
  mapfile -t candidates < <(
    git log --no-merges --reverse --format=%H \
      "refs/remotes/origin/${earlier}..refs/remotes/origin/${later}" 2>/dev/null |
      head -n "${HISTORY_LIMIT:-200}"
  )
  if [ "${#candidates[@]}" -eq 0 ]; then
    note "${earlier} already has every commit ${later} does."
    skipped_because "stages-aligned"
    continue
  fi

  # The sha filter above is not the answer, only a cheap way to get the candidates: under a
  # rebase promotion every change that went up the chain is in that list. This is the filter
  # that decides.
  mapfile -t present < <(patch_ids_of "refs/remotes/origin/${earlier}")

  to_pick=()
  for sha in "${candidates[@]}"; do
    pid="$(git show "$sha" 2>/dev/null | git patch-id --stable 2>/dev/null | cut -d' ' -f1)"
    already=false
    for known in "${present[@]}"; do
      if [ -n "$pid" ] && [ "$pid" = "$known" ]; then
        already=true
        break
      fi
    done
    [ "$already" = true ] || to_pick+=("$sha")
  done

  if [ "${#to_pick[@]}" -eq 0 ]; then
    note "${earlier} already carries the content of every commit on ${later}; the shas differ because promotion rebases."
    skipped_because "stages-aligned"
    continue
  fi

  note "${earlier} is missing ${#to_pick[@]} commit(s) that ${later} has."

  sync_branch="sync/${earlier}-${GITHUB_RUN_ID:-0}"

  # The deny-list applies to what this job writes exactly as it does to an agent's push: a
  # stage, the branch point or a release branch is never a synchronisation head (FR-063).
  if ! BRANCH="$sync_branch" \
    DENIED_BRANCHES="${STAGE_BRANCHES}" \
    RELEASE_PATTERN="${RELEASE_PATTERN:-}" \
    BRANCH_PATTERN="${SYNC_BRANCH_PATTERN:-^sync/}" \
    DEFAULT_BRANCH="${DEFAULT_BRANCH:-}" \
    bash "${GITHUB_ACTION_PATH}/../guard-branch-write/guard-branch-write.sh"; then
    note "Refusing to write ${sync_branch}; nothing done for ${later} → ${earlier}."
    continue
  fi

  git switch --detach "refs/remotes/origin/${earlier}" >/dev/null 2>&1
  git switch -c "$sync_branch" >/dev/null 2>&1

  picked=true
  conflict_sha=""
  conflict_files=""
  for sha in "${to_pick[@]}"; do
    if git cherry-pick "$sha" >/dev/null 2>&1; then
      continue
    fi
    # Nothing staged means the content is already here by another route, one step later than
    # the patch-id filter says so. Skipping it is the same answer and is why a re-run neither
    # duplicates nor fails.
    if git diff --cached --quiet 2>/dev/null && git diff --quiet 2>/dev/null; then
      git cherry-pick --skip >/dev/null 2>&1 || git cherry-pick --abort >/dev/null 2>&1 || true
      continue
    fi
    # Read before the abort: the abort is what throws the answer away, and a hand-off that
    # says only "it conflicts" leaves the person to find out where, which is the work.
    conflict_sha="$sha"
    conflict_files="$(git diff --name-only --diff-filter=U 2>/dev/null | head -n 20 | tr '\n' ' ')"
    git cherry-pick --abort >/dev/null 2>&1 || true
    picked=false
    break
  done

  if [ "$picked" != true ]; then
    # Nothing has been pushed: the branch exists in this checkout only, both stages are
    # exactly as they were. No agent is asked to resolve it, for the same reason promotion
    # does not (T131, FR-034): the only resolution an agent could push is a merge of the
    # target, and under a replaying merge method that resolution is dropped and the conflict
    # returns.
    #
    # The hand-off is an annotation and the outcome line rather than an issue comment,
    # because a back-propagation belongs to no issue: what arrived outside the loop had no
    # issue in the loop, which is the whole reason it is here.
    conflict_subject="$(git log -1 --format=%s "$conflict_sha" 2>/dev/null || true)"
    note "::error::${later} → ${earlier}: ${conflict_sha:0:8} (${conflict_subject:-no subject}) does not apply onto ${earlier}. Conflicting files: ${conflict_files:-not recorded}. Nothing was pushed; both branches are as they were. Carry it across by hand: branch from ${earlier}, cherry-pick ${conflict_sha:0:8}, resolve, and open a pull request into ${earlier}."
    skipped_because "conflict-handed-off"
    git switch --detach "refs/remotes/origin/${earlier}" >/dev/null 2>&1 || true
    continue
  fi

  # Every pick was empty: the content is present under different shas after all, so there is
  # nothing to open a pull request about. Asked of the repository rather than counted from
  # the loop above, because an empty pick is skipped inside it.
  if [ "$(git rev-parse HEAD)" = "$(git rev-parse "refs/remotes/origin/${earlier}")" ]; then
    note "Every commit applied empty onto ${earlier}: the content is already there."
    skipped_because "stages-aligned"
    git switch --detach "refs/remotes/origin/${earlier}" >/dev/null 2>&1 || true
    continue
  fi

  git push --force-with-lease origin "HEAD:refs/heads/${sync_branch}"

  body="Carries content from \`${later}\` back to \`${earlier}\`.

A change reached \`${later}\` without coming up the chain -- a hotfix, an administrative push, or a revert -- so \`${earlier}\` does not have it. Until it does, every pull request into \`${earlier}\` carries this delta as well as its own change.

Commits carried: ${#to_pick[@]}. Nothing on \`${later}\` was touched, and nothing on \`${earlier}\` is removed by this: it adds the content that is missing and no more.

<!-- sync-pr: ${earlier}: ${later} -->"
  new_pr="$(gh pr create --repo "$REPO" --base "$earlier" --head "$sync_branch" \
    --title "${TITLE_PREFIX:-[bot] }sync ${later} to ${earlier}" --body "$body" |
    grep -oE '[0-9]+$' || true)"

  note "Opened pull request #${new_pr:-?} carrying ${later} into ${earlier}."
  opened=$((opened + 1))
  reason="acted"
  git switch --detach "refs/remotes/origin/${earlier}" >/dev/null 2>&1 || true
done

finish
