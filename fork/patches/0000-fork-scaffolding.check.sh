#!/usr/bin/env bash
# 0000 fork scaffolding: the fork's docs exist, the agent files point at
# FORK.md, every patch row has a record, and upstream pushes stay disabled.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "0000: $*" >&2; exit 1; }

for f in FORK.md PATCHES.md fork/patches/TEMPLATE.md fork/update.sh fork/check.sh; do
  [ -f "$f" ] || fail "missing $f"
done

for f in AGENTS.md CLAUDE.md; do
  head -12 "$f" | grep -q 'Read \[`FORK.md`\](FORK.md) before anything else' \
    || fail "$f lost its FORK.md pointer at the top"
done

# Every patch ID in PATCHES.md has a record file, and every record is listed.
ids="$(grep -oE '^\| \[[0-9]{4}\]' PATCHES.md | grep -oE '[0-9]{4}' | sort -u)"
[ -n "$ids" ] || fail "no patches listed in PATCHES.md"
for id in $ids; do
  ls fork/patches/"$id"-*.md >/dev/null 2>&1 || fail "PATCHES.md lists $id but fork/patches/$id-*.md is missing"
done
for rec in fork/patches/[0-9][0-9][0-9][0-9]-*.md; do
  id="$(basename "$rec" | cut -c1-4)"
  grep -qE "^\| \[$id\]|^\| $id " PATCHES.md || fail "$rec is not listed in PATCHES.md"
  grep -q '\*\*Remove when\*\*' "$rec" || fail "$rec has no 'Remove when'"
done

# Every fork(NNNN) commit on the branch has a record, and every commit on top
# of the base tag is a fork(NNNN) commit.
base="$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' HEAD)"
while read -r sha subject; do
  id="$(printf '%s' "$subject" | sed -nE 's/^fork\(([0-9]{4})\): .*/\1/p')"
  [ -n "$id" ] || fail "commit $sha on top of $base is not a fork(NNNN): commit: $subject"
  ls fork/patches/"$id"-*.md >/dev/null 2>&1 || fail "commit $sha (patch $id) has no fork/patches/$id-*.md record"
done < <(git log --format='%h %s' "$base..HEAD")

push_url="$(git remote get-url --push upstream 2>/dev/null || true)"
case "$push_url" in
  *github.com*) fail "upstream push URL is live: $push_url" ;;
esac

# FORK.md rule 5: nothing private in the fork's changes or commit messages.
# The words live in an untracked, per-clone file, never in the repository.
words="$(git rev-parse --git-common-dir)/info/fork-private-words"
if [ -f "$words" ]; then
  pattern="$(grep -vE '^[[:space:]]*(#|$)' "$words" | paste -sd'|' -)"
  if [ -n "$pattern" ]; then
    hits="$( { { git diff "$base" -- .; git diff --cached -- .; } | grep -E '^\+' | grep -v '^+++ ';
      git log --format='%s%n%b' "$base..HEAD"; git branch --format='%(refname:short)'; } \
      | grep -iE -- "$pattern" || true)"
    if [ -n "$hits" ]; then
      echo "$hits" | cut -c1-200 >&2
      fail "private words (from $words) in the fork's changes or commit messages; see FORK.md rule 5"
    fi
  fi
else
  echo "0000: warning: $words is missing, so the private-words scan was skipped (FORK.md rule 5)" >&2
fi

bash -n fork/update.sh fork/check.sh || fail "script syntax error"
