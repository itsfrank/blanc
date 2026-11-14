#!/usr/bin/env bash
# Moves the fork's patch stack (branch `personal`) onto a newer upstream
# release tag. See FORK.md → "Updating to a new upstream release".
#
#   fork/update.sh [--skip-baseline] [vX.Y.Z]   update (default: newest release)
#   fork/update.sh --verify                     after resolving conflicts and
#                                               finishing the rebase: range-diff + checks
set -euo pipefail

BRANCH=personal
STATE_FILE=".git/fork-update-state"

die() { echo "fork/update.sh: $*" >&2; exit 1; }
say() { echo "==> $*"; }

root="$(git rev-parse --show-toplevel)"
cd "$root"
STATE_FILE="$(git rev-parse --git-dir)/fork-update-state"

skip_baseline=0
verify_only=0
target=""
for arg in "$@"; do
  case "$arg" in
    --skip-baseline) skip_baseline=1 ;;
    --verify) verify_only=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    v*) target="$arg" ;;
    *) die "unknown argument: $arg" ;;
  esac
done

check_setup() {
  [ "$(git config --bool rerere.enabled || true)" = "true" ] || die "rerere is off; run the git config commands in FORK.md"
  local push_url
  push_url="$(git remote get-url --push upstream 2>/dev/null || true)"
  [ -n "$push_url" ] || die "no 'upstream' remote; see FORK.md → Git setup"
  case "$push_url" in
    *github.com*) die "upstream push URL is live ($push_url); disable it: git remote set-url --push upstream DISABLED-do-not-push-to-upstream" ;;
  esac
}

verify() {
  local old_tip="$1" old_base="$2" new_base="$3"
  say "Patches before and after (git range-diff):"
  git --no-pager range-diff "$old_base..$old_tip" "$new_base..$BRANCH" || true
  echo
  say "Patch commits now on $BRANCH:"
  git --no-pager log --oneline "$new_base..$BRANCH"
  echo
  local stray
  stray="$(git log --format='%h %s' "$new_base..$BRANCH" | grep -v ' fork([0-9]\{4\}): ' || true)"
  if [ -n "$stray" ]; then
    echo "WARNING: commits without a fork(NNNN): subject (squash them into their patch):"
    echo "$stray"
    echo
  fi
  say "Running fork/check.sh"
  if fork/check.sh; then
    rm -f "$STATE_FILE"
    echo
    echo "Update to $new_base done. Next (FORK.md → After the update):"
    echo "  - read the range-diff above"
    echo "  - update 'Based on' and 'Last verified on' in PATCHES.md (squash into the patch commits)"
    echo "  - build and smoke-test, then: git push --force-with-lease origin $BRANCH"
  else
    echo
    echo "Checks failed after the update. Fix them in the owning patch's commit"
    echo "(git commit --fixup <sha>; git rebase -i --autosquash $new_base), then: fork/update.sh --verify"
    exit 1
  fi
}

check_setup

if [ "$verify_only" = 1 ]; then
  [ -f "$STATE_FILE" ] || die "no update in progress (missing $STATE_FILE)"
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  [ -z "$(git status --porcelain)" ] || die "work tree not clean; finish the rebase first"
  [ ! -d "$(git rev-parse --git-path rebase-merge)" ] || die "rebase still in progress; resolve and run: git rebase --continue"
  verify "$OLD_TIP" "$OLD_BASE" "$NEW_BASE"
  exit 0
fi

[ "$(git branch --show-current)" = "$BRANCH" ] || die "not on '$BRANCH'"
[ -z "$(git status --porcelain)" ] || die "work tree not clean"
[ ! -d "$(git rev-parse --git-path rebase-merge)" ] || die "a rebase is already in progress"

say "Fetching upstream tags"
git fetch upstream --tags --quiet

old_base="$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' "$BRANCH")"
old_tip="$(git rev-parse "$BRANCH")"

if [ -z "$target" ]; then
  if command -v gh >/dev/null 2>&1; then
    # Newest published (non-draft, non-prerelease) release.
    target="$(gh release list -R bnfy/blanc --exclude-drafts --exclude-pre-releases --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || true)"
  fi
  if [ -z "$target" ]; then
    target="$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)"
    echo "note: gh unavailable, using newest tag $target (check it is a published release)"
  fi
fi
git rev-parse -q --verify "refs/tags/$target" >/dev/null || die "tag $target not found"

echo "Current base: $old_base"
echo "Target:       $target"
if [ "$old_base" = "$target" ]; then
  echo "Already on $target. Nothing to do."
  exit 0
fi
git merge-base --is-ancestor "$old_base" "$target" || die "$target is not newer than $old_base"

if [ "$skip_baseline" = 0 ]; then
  say "Baseline: running fork/check.sh on the current branch"
  fork/check.sh || die "checks fail BEFORE the update; fix those first (or --skip-baseline)"
fi

backup="fork-backup/${old_base}-$(date +%Y%m%d-%H%M%S)"
git tag "$backup" "$old_tip"
say "Backup tag: $backup"

cat > "$STATE_FILE" <<EOF
OLD_TIP=$old_tip
OLD_BASE=$old_base
NEW_BASE=$target
BACKUP=$backup
EOF

say "Rebasing $BRANCH onto $target"
if ! git rebase --onto "$target" "$old_base" "$BRANCH"; then
  cat <<EOF

Rebase stopped on a conflict. For each conflicted file (FORK.md → Resolving conflicts):
  1. Read upstream's change:  git log -p $old_base..$target -- <file>
  2. Read the patch's record in fork/patches/
  3. Keep upstream's change, re-apply the patch's intent; check any rerere replay
  4. git add <file>, then: git rebase --continue
When the rebase finishes, run:  fork/update.sh --verify
To give up:                     git rebase --abort   (backup: $backup)
EOF
  exit 2
fi

verify "$old_tip" "$old_base" "$target"
