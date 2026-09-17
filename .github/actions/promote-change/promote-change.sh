#!/usr/bin/env bash
# Managed by @plainconceptsplatform/workflows@0.5.1. Source: loops/actions/promote-change/promote-change.sh. Profile digest: 2a25c134fca6. Update with `workflows update --force`; consumer edits may be overwritten.
#
# Move the changes that are ready one stage along the chain (FR-031).
#
# Deterministic from end to end, and deliberately not an agent: which commits belong to a
# change, whether its soak has elapsed and where it goes next are arithmetic over the forge
# and the clock. An agent here would also be unable to do the job -- its push applies a git
# bundle fast-forward only, and a promotion recreates a branch on the next stage and
# cherry-picks onto it, which is not a fast-forward of anything (research R2).
#
# One target at a time, oldest change first, and nothing is forced: a promotion that cannot
# be made cleanly is left for a person, with the reason on the issue.

set -euo pipefail

: "${REPO:?promote-change: REPO is required}"
: "${STAGE_BRANCHES:?promote-change: STAGE_BRANCHES is required}"

# shellcheck source-path=SCRIPTDIR
# shellcheck source=../resolve-pr-issue/resolve-pr-issue.sh
. "${GITHUB_ACTION_PATH}/../resolve-pr-issue/resolve-pr-issue.sh"

promoted=0
reason="no-eligible-change"

note() { echo "$*"; }

# One run looks at every pair in the chain and every merged change on each, so it collects
# several answers and reports one (FR-058).
#
# A promotion that happened outweighs anything skipped afterwards: the outcome line says
# what the run did, and it did promote. Among the skips the ranking is how much each wants a
# person, because letting the last one win hides the ones that do: a run that handed a
# conflict over and then passed over a change already present would report the change
# already present, and nobody would go and look at the conflict.
skipped_because() {
  local candidate="$1" entry
  [ "$promoted" -eq 0 ] || return 0
  for entry in conflict-handed-off rollback hold hotfix soak-pending already-present no-eligible-change; do
    case "$entry" in
      "$candidate") reason="$candidate"; return 0 ;;
      "$reason") return 0 ;;
    esac
  done
}

# `dev,test,main` as an array, in chain order: promotion is always from one entry to the
# next, so the pairs are what this file actually works in.
IFS=',' read -r -a stages <<<"$STAGE_BRANCHES"
if [ "${#stages[@]}" -lt 2 ]; then
  note "This repository has one stage, so there is nowhere to promote to."
  {
    echo "promoted=0"
    echo "reason=no-eligible-change"
  } >>"${GITHUB_OUTPUT:-/dev/stdout}"
  exit 0
fi

# The soak a stage demands, from `stage=duration` pairs. An absent entry is no soak.
soak_for() {
  local stage="$1" pair
  while IFS= read -r pair; do
    [ -n "$pair" ] || continue
    case "$pair" in
      "${stage}="*) printf '%s' "${pair#*=}"; return 0 ;;
    esac
  done < <(printf '%s\n' "${SOAK:-}" | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  printf '0'
}

# `30m`, `48h`, `5d` in seconds. The schema has already refused anything else.
duration_seconds() {
  local value="${1:-0}" number unit
  number="${value%[a-z]}"
  unit="${value##*[0-9]}"
  case "$unit" in
    m) echo $((number * 60)) ;;
    h) echo $((number * 3600)) ;;
    d) echo $((number * 86400)) ;;
    *) echo 0 ;;
  esac
}

# Every commit reachable from a ref, as patch-ids. A patch-id is the content, so the same
# change cherry-picked, rebased or squashed answers the same both sides of a promotion --
# which is what "already present" has to mean. A message comparison would call two
# different fixes with the same subject the same commit, and a re-run would then skip work
# it had never done (FR-032).
patch_ids_of() {
  local ref="$1" limit="${2:-500}" sha
  git log --format=%H "$ref" 2>/dev/null | head -n "$limit" | while read -r sha; do
    git show "$sha" 2>/dev/null | git patch-id --stable 2>/dev/null | cut -d' ' -f1
  done
}

# The commits this change is made of, which is a different question per merge method
# (FR-032). None of them is "the commits on the branch": promotion force-pushes branches,
# so the branch is this route's own scratch space rather than a record of anything.
identify_commits() {
  local pr="$1"
  local merge_commit

  case "${MERGE_METHOD:-rebase}" in
    rebase)
      # The forge replayed each commit onto the base, so the pull request's own list is the
      # change. Read through refs/pull/N/head, because the branch it came from may already
      # have been force-pushed by a later promotion, and fetched explicitly since a checkout
      # brings down heads only.
      git fetch --no-tags --quiet origin "refs/pull/${pr}/head:refs/remotes/pull/${pr}" 2>/dev/null || true
      gh api "repos/${REPO}/pulls/${pr}/commits" --paginate --jq '.[].sha'
      ;;
    squash)
      # One commit, written by the forge, containing the whole change. Reconstructing the
      # pull request's own commits here would put work on the next stage that never existed
      # on this one.
      gh api "repos/${REPO}/pulls/${pr}" --jq '.merge_commit_sha // empty'
      ;;
    merge)
      # A merge commit has two parents: the stage, and the change. Everything reachable from
      # the second parent and not from the first is what came in with it, oldest first, and
      # the merge commit itself is not carried -- it joins two histories this stage does not
      # have.
      merge_commit="$(gh api "repos/${REPO}/pulls/${pr}" --jq '.merge_commit_sha // empty')"
      [ -n "$merge_commit" ] || return 0
      git fetch --no-tags --quiet origin "$merge_commit" 2>/dev/null || true
      git rev-list --reverse --no-merges "${merge_commit}^1..${merge_commit}^2" 2>/dev/null || true
      ;;
  esac
}

# Was this change taken back out of the stage it is being promoted from?
#
# The label is the polite way to say so, and somebody reverting a commit on `dev` at five
# o'clock is not thinking about labels. Half an hour later the promotion route would carry
# the same change onto `test`, because a label was the only thing it was looking at. git
# writes the answer into the revert itself -- `This reverts commit <sha>` -- so it is there
# whether or not a person thought to say so.
#
# Matched by patch-id rather than by sha, because the sha on the stage is not the sha in the
# pull request under squash, and need not be under rebase either: what a revert undoes is a
# content, and content is what identifies a change throughout this file (FR-032). The
# reverted commit has to be one this clone can read, which it is when it is an ancestor of
# the stage the revert is on; when it is not, there is nothing to compare and the label
# remains the only signal.
was_rolled_back() {
  local stage="$1"
  shift
  local change_ids=("$@")
  local trailer reverted_sha reverted_id known

  while IFS= read -r trailer; do
    reverted_sha="${trailer##* }"
    [ -n "$reverted_sha" ] || continue
    git cat-file -e "${reverted_sha}^{commit}" 2>/dev/null || continue

    reverted_id="$(git show "$reverted_sha" 2>/dev/null | git patch-id --stable 2>/dev/null | cut -d' ' -f1)"
    [ -n "$reverted_id" ] || continue

    for known in "${change_ids[@]}"; do
      if [ "$known" = "$reverted_id" ]; then
        printf '%s' "$reverted_sha"
        return 0
      fi
    done
  done < <(git log -n 200 --format=%B "refs/remotes/origin/${stage}" 2>/dev/null |
    grep -oE 'This reverts commit [0-9a-f]{7,40}' || true)

  return 1
}

has_label() {
  local issue="$1" name="$2"
  [ -n "$name" ] || return 1
  gh issue view "$issue" --repo "$REPO" --json labels --jq '[.labels[].name]' 2>/dev/null |
    jq -e --arg name "$name" 'index($name)' >/dev/null 2>&1
}

# env-promotion reconstructs nothing: its head is a snapshot of the previous stage branch,
# so there is no cherry-picking to do and T169 builds that path. Anything else that reaches
# this file promotes by carrying commits across.
if [ "${BRANCH_STRATEGY:-}" = "env-promotion" ]; then
  note "This repository promotes by snapshotting the previous stage, which this route does not build yet."
  {
    echo "promoted=0"
    echo "reason=no-eligible-change"
  } >>"${GITHUB_OUTPUT:-/dev/stdout}"
  exit 0
fi

for index in "${!stages[@]}"; do
  [ "$index" -gt 0 ] || continue
  previous="${stages[index - 1]}"
  next="${stages[index]}"

  note "── ${previous} → ${next} ─────────────────────────────────────────"

  soak_seconds="$(duration_seconds "$(soak_for "$next")")"

  # One change at a time per target (FR-033). A stage that takes two promotions at once gets
  # two pull requests built on the same tip: whichever merges second carries a change the
  # first one never saw, and the order they land in becomes whoever's CI finished first
  # rather than the order the work was done in. So a target with a promotion still open is a
  # target this run leaves alone, and the change behind it goes when that one lands.
  #
  # Matched on the promotion marker and this stage's name, which only this route writes: an
  # agent's own pull request opens against the first stage, which is never a target here.
  open_promotion="$(gh pr list --repo "$REPO" --state open --base "$next" --json number,body \
    --jq "[.[] | select((.body // \"\") | contains(\"<!-- promotion-pr: ${next}: \"))][0].number // empty")"
  if [ -n "$open_promotion" ]; then
    note "Promotion pull request #${open_promotion} into ${next} is still open; nothing else goes to ${next} until it lands."
    skipped_because "already-present"
    continue
  fi

  # The changes that landed on the previous stage, oldest first: a promotion that jumps the
  # queue puts a later change on a stage before the one it was built on (FR-033).
  while IFS=$'\t' read -r pr merged_at; do
    [ -n "$pr" ] || continue

    issue="$(pr_issue "$pr")"
    if [ -z "$issue" ]; then
      note "PR #${pr}: no issue this loop knows; leaving it alone."
      continue
    fi

    if has_label "$issue" "${HOLD_LABEL:-}"; then
      note "Issue #${issue} carries ${HOLD_LABEL}; not promoting."
      skipped_because "hold"
      continue
    fi
    if has_label "$issue" "${ROLLBACK_LABEL:-}"; then
      note "Issue #${issue} carries ${ROLLBACK_LABEL}; not promoting."
      skipped_because "rollback"
      continue
    fi
    if has_label "$issue" "${HOTFIX_LABEL:-}"; then
      note "Issue #${issue} carries ${HOTFIX_LABEL}; it takes its own path."
      skipped_because "hotfix"
      continue
    fi

    merged_epoch="$(date -u -d "$merged_at" +%s 2>/dev/null || echo 0)"
    age=$(( $(date -u +%s) - merged_epoch ))
    if [ "$merged_epoch" -gt 0 ] && [ "$age" -lt "$soak_seconds" ]; then
      note "Issue #${issue}: $((age / 60))m on ${previous}, and ${next} asks for $((soak_seconds / 60))m."
      skipped_because "soak-pending"
      continue
    fi

    promotion_branch="promote/${next}-${issue}-${GITHUB_RUN_ID:-0}"

    # The deny-list applies to what this job is about to write, exactly as it does to an
    # agent's push: a stage, the branch point or a release branch is never a promotion head
    # (FR-063).
    if ! BRANCH="$promotion_branch" \
      DENIED_BRANCHES="${STAGE_BRANCHES}" \
      RELEASE_PATTERN="${RELEASE_PATTERN:-}" \
      BRANCH_PATTERN="${PROMOTION_BRANCH_PATTERN:-^promote/}" \
      DEFAULT_BRANCH="${DEFAULT_BRANCH:-}" \
      bash "${GITHUB_ACTION_PATH}/../guard-branch-write/guard-branch-write.sh"; then
      note "Refusing to write ${promotion_branch}; nothing done for issue #${issue}."
      continue
    fi

    git fetch --no-tags origin "${previous}:refs/remotes/origin/${previous}" "${next}:refs/remotes/origin/${next}" >/dev/null 2>&1 || true

    mapfile -t commits < <(identify_commits "$pr")
    if [ "${#commits[@]}" -eq 0 ]; then
      note "PR #${pr} yields no commits under ${MERGE_METHOD:-rebase}; leaving issue #${issue} where it is."
      continue
    fi

    # Two filters, both by content. The branch point's history is excluded because under a
    # chain the work was cut from it and merged back into it, so its own commits are
    # reachable from the pull request and are not this change (FR-032). The next stage's is
    # excluded because a re-run must not duplicate what it already carried across.
    mapfile -t present < <(
      patch_ids_of "refs/remotes/origin/${next}"
      [ -z "${BRANCH_POINT:-}" ] || patch_ids_of "refs/remotes/origin/${BRANCH_POINT}"
    )

    to_pick=()
    change_ids=()
    for sha in "${commits[@]}"; do
      pid="$(git show "$sha" 2>/dev/null | git patch-id --stable 2>/dev/null | cut -d' ' -f1)"
      [ -z "$pid" ] || change_ids+=("$pid")
      already=false
      for known in "${present[@]}"; do
        if [ -n "$pid" ] && [ "$pid" = "$known" ]; then
          already=true
          break
        fi
      done
      [ "$already" = true ] || to_pick+=("$sha")
    done

    # Asked before "is there anything left to carry", because a change that was reverted on
    # the previous stage after an earlier promotion must stop travelling too: labelling it
    # here is what stops the next stage in the chain from taking it (FR-053).
    if [ "${#change_ids[@]}" -gt 0 ] && reverted="$(was_rolled_back "$previous" "${change_ids[@]}")"; then
      note "::warning::Issue #${issue} was reverted on ${previous} by ${reverted:0:8}; not promoting it to ${next}."
      # The comment is written once: the label it adds is checked before any of this on the
      # next run, so a rollback is announced rather than repeated every time the cron fires.
      if gh issue edit "$issue" --repo "$REPO" --add-label "${ROLLBACK_LABEL:-}" >/dev/null 2>&1; then
        gh issue comment "$issue" --repo "$REPO" --body "This change was reverted on \`${previous}\` by ${reverted:0:8}, so the promotion route has stopped carrying it and has marked it \`${ROLLBACK_LABEL}\`. Remove the label when the change is meant to travel again." >/dev/null 2>&1 || true
      fi
      skipped_because "rollback"
      continue
    fi

    if [ "${#to_pick[@]}" -eq 0 ]; then
      note "Issue #${issue}: every commit is already on ${next}."
      skipped_because "already-present"
      continue
    fi

    git switch --detach "refs/remotes/origin/${next}" >/dev/null 2>&1
    git switch -c "$promotion_branch" >/dev/null 2>&1

    picked=true
    conflict_sha=""
    conflict_files=""
    for sha in "${to_pick[@]}"; do
      if git cherry-pick "$sha" >/dev/null 2>&1; then
        continue
      fi
      # A cherry-pick that leaves nothing staged is a change already present by another
      # route -- a hotfix, a manual carry -- and not a conflict. Skipping it is the same
      # answer the patch-id filter gives, one step later, and is why a re-run neither
      # duplicates nor fails (FR-032).
      if git diff --cached --quiet 2>/dev/null && git diff --quiet 2>/dev/null; then
        git cherry-pick --skip >/dev/null 2>&1 || git cherry-pick --abort >/dev/null 2>&1 || true
        continue
      fi
      # Which commit, and which files: read before the abort, because the abort is what
      # throws the answer away. A hand-off that says only "it conflicts" leaves the person
      # to find out where, which is the whole of the work.
      conflict_sha="$sha"
      conflict_files="$(git diff --name-only --diff-filter=U 2>/dev/null | head -n 20 | tr '\n' ' ')"
      git cherry-pick --abort >/dev/null 2>&1 || true
      picked=false
      break
    done

    if [ "$picked" != true ]; then
      # Nothing has been pushed: the promotion branch exists only in this checkout, the
      # previous stage is untouched, and the change's own branch is where it was. The
      # cherry-pick was aborted, so the index is clean and the run can carry on with the
      # next target (FR-034).
      #
      # No agent is asked to resolve it. Under rebase the forge replays each commit onto
      # the base and cannot replay a merge commit, so the only resolution an agent could
      # push -- merging the target in -- is the one FR-027 forbids: it would be dropped at
      # merge time and the conflict would come back. Under any method the agent's push is a
      # bundle applied fast-forward only, and a resolution is not a fast-forward.
      conflict_subject="$(git log -1 --format=%s "$conflict_sha" 2>/dev/null || true)"
      note "::warning::Issue #${issue}: ${conflict_sha:0:8} does not apply onto ${next}; handing it to a person."

      # `hold` before the comment: the label is what stops the next run trying again, and a
      # comment without it would be a repeated apology every time the cron fires.
      gh issue edit "$issue" --repo "$REPO" --add-label "${HOLD_LABEL:-}" >/dev/null 2>&1 || true
      gh issue comment "$issue" --repo "$REPO" --body "Promotion to \`${next}\` stopped: \`${conflict_sha:0:8}\` (${conflict_subject:-no subject}) does not apply cleanly.

Conflicting files: ${conflict_files:-not recorded}

Nothing was pushed. \`${previous}\` and this change's own branch are exactly as they were, and the issue now carries \`${HOLD_LABEL:-hold}\`, which is what keeps the route from trying this again on the next run.

Carrying it across is a person's job: no agent is asked to resolve a promotion conflict, because the only resolution one could push is a merge of the target branch, and under a replaying merge method that resolution is dropped and the conflict returns. Remove \`${HOLD_LABEL:-hold}\` when the change is ready to travel again."
      skipped_because "conflict-handed-off"
      git switch --detach "refs/remotes/origin/${next}" >/dev/null 2>&1 || true
      continue
    fi

    # The changelog entry rides the head, before the push: one branch, one push, one pull
    # request, and no entry on a branch whose promotion then failed to open. Which stages get
    # one is the profile's answer and the script's to check (FR-023).
    #
    # A changelog that cannot be written does not stop a promotion: the entry is a record of
    # the change, and refusing to move the change because the record failed is the wrong way
    # round. It is a warning on the run either way.
    if ! STAGE="$next" \
      ISSUE_NUMBER="$issue" \
      COMMIT_SHA="$(git rev-parse HEAD)" \
      HEAD_BRANCH="" \
      MAX_ENTRIES="${MAX_ENTRIES:-20}" \
      GIT_IDENTITY="${GIT_IDENTITY:-$(git config user.name)}" \
      bash "${GITHUB_ACTION_PATH}/../update-changelog/update-changelog.sh"; then
      note "::warning::Issue #${issue}: the changelog entry for ${next} could not be written; promoting without it."
    fi

    git push --force-with-lease origin "HEAD:refs/heads/${promotion_branch}"

    body="Promotes the change from \`${previous}\` to \`${next}\`.

<!-- implement-issue: ${issue} -->
<!-- promotion-pr: ${next}: ${pr} -->"
    new_pr="$(gh pr create --repo "$REPO" --base "$next" --head "$promotion_branch" \
      --title "${TITLE_PREFIX:-[bot] }promote #${issue} to ${next}" --body "$body" |
      grep -oE '[0-9]+$' || true)"

    note "Issue #${issue}: opened promotion pull request #${new_pr:-?} into ${next}."
    promoted=$((promoted + 1))
    reason="promoted"
    # This target is busy now, and the changes behind this one keep their order by waiting:
    # the next run finds this pull request open and leaves the stage alone until it lands.
    break
  done < <(gh pr list --repo "$REPO" --state merged --base "$previous" --limit 50 \
    --json number,mergedAt,author \
    --jq '[.[] | select(.author.is_bot)] | sort_by(.mergedAt) | .[] | [.number, .mergedAt] | @tsv')
done

{
  echo "promoted=${promoted}"
  echo "reason=${reason}"
} >>"${GITHUB_OUTPUT:-/dev/stdout}"

note "Promotions opened: ${promoted}."
