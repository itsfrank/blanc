# FORK.md: itsfrank/blanc, a personal patched Blanc

This repository is a **personal fork** of [bnfy/blanc](https://github.com/bnfy/blanc).
It exists to carry a small number of personal patches on top of upstream
releases. It is built for one person's own use on one Mac and is **never
distributed**. Nothing here is a Blanc release, and none of the upstream
release, notarization, marketing or website procedures apply to it.

**Agents: this file has priority over `AGENTS.md` and `CLAUDE.md`.** Those files
are upstream's instructions for the owner's official project. Use them for how
the code works, but where they conflict with this file, follow this file.

Read [`PATCHES.md`](PATCHES.md) next. It lists every patch this fork carries.

## Layout

| Path | What it is |
|---|---|
| `FORK.md` | This file: the fork's rules and the update runbook |
| `PATCHES.md` | The patch list: one row per patch, in order |
| `fork/patches/NNNN-<slug>.md` | One file per patch: why, design, hooks, tests, known conflicts, when to remove it |
| `fork/patches/NNNN-<slug>.check.sh` | Optional: fast checks that prove that patch still works |
| `fork/patches/TEMPLATE.md` | Template for a new patch file |
| `fork/update.sh` | Moves the patch stack onto a newer upstream release |
| `fork/check.sh` | Runs every patch's checks |

Fork-only files live at the root (`FORK.md`, `PATCHES.md`) and under `fork/`,
which upstream does not use, so they never conflict.

## Git setup

| Remote or branch | What it is |
|---|---|
| `upstream` | `https://github.com/bnfy/blanc`. **Fetch only**: its push URL is set to `DISABLED-do-not-push-to-upstream` |
| `origin` | `https://github.com/itsfrank/blanc.git`, this fork |
| `personal` | The fork's branch, and its GitHub default branch: upstream release tag + the patch stack |
| `main` | A plain copy of upstream's `main`. Never commit to it |

`personal` is always **one upstream release tag plus the patches in
`PATCHES.md`, in order**. Nothing else goes on it.

Local git settings (set once per clone; `fork/update.sh` checks them):

```sh
git config rerere.enabled true        # remember conflict resolutions
git config rerere.autoUpdate false    # replayed fixes stay unstaged until checked
git config gc.rerereResolved 365      # keep resolutions a year (updates are infrequent)
git config gc.rerereUnresolved 60
git config rebase.updateRefs true
git remote set-url --push upstream DISABLED-do-not-push-to-upstream
```

GitHub Actions are **disabled** on this fork. Upstream's workflows need
the owner's secrets and runners; don't turn them on.

## Rules for patches

1. **One commit per patch.** Its subject starts with `fork(NNNN): `, for
   example `fork(0001): disable auto-update`. IDs are four digits, assigned in
   order and never reused. A fix to a patch is squashed into that patch's
   commit (`git commit --fixup <sha>` then
   `git rebase -i --autosquash <base-tag>`), never left as a separate commit.
2. **Touch upstream files as little as possible.** Put the patch's logic in new
   files (for example `src/main/fork/<slug>.js`) and add only a small hook,
   ideally one line, to the upstream file that calls it. Upstream edits
   `src/main/main.js` (about 17,000 lines) in almost every release, so every
   line changed there is a likely conflict. Never copy an upstream function to
   modify it; wrap it or hook into it.
3. **Every patch has a record.** Add its row to `PATCHES.md` and its
   `fork/patches/NNNN-<slug>.md` (from `TEMPLATE.md`) **in the same commit**.
   The record must state when the patch can be removed.
4. **Every patch has a check** that fails if the patch stops working, ideally a
   unit test plus a `fork/patches/NNNN-<slug>.check.sh`. A merge with no
   conflicts can still be broken: if upstream renames a function a patch
   calls, git reports nothing. Only a check catches it.
5. **Keep private details out of the repository.** The fork is public (GitHub
   doesn't allow private forks of public repositories). Work hostnames, account
   names and tokens go in local, untracked configuration, never in commits.
   **Never name the employer, or anything internal or possibly internal**, in
   any file, comment, record, commit message or branch name: no company name,
   internal tool or sandbox names, ticket IDs, internal hostnames, URLs or
   links, team or project names. Describe the thing instead ("the agent
   sandbox", "the work Okta tenant"). Public products and services may be
   named generally (Okta, Glean, Slack, GitHub), with `example.…` hosts only.
   The `0000` check scans every fork change and commit message for the words
   listed, one extended regex per line, in the untracked file
   `$(git rev-parse --git-common-dir)/info/fork-private-words`; create it on
   each clone (see Setting up another Mac). The list itself is private, so it
   never goes in the repository either.
6. **Write patches upstream could accept.** A patch that upstream merges
   is one less to carry. When a patch is a reasonable general feature, propose
   it upstream (issue first; see the patch's record) and remove it when an
   upstream release includes it.
7. **Respect upstream's licensing.** The code is MIT, but the Blanc name and
   marks are reserved (`ASSET-LICENSE.md`). That is fine for personal use; it
   is one of the reasons this fork is never distributed.

## What does not apply here

Upstream's `AGENTS.md` describes the owner's release and publishing work. In
this fork, ignore everything about: `npm run release` and `scripts/release.sh`,
notarization, the Developer ID and provisioning profile, Sigstore, What's New
pages, the website and `site:deploy`, marketing claims, social posts, launch
gates, Polar and licensing operations, and bumping `version` or
`build.mac.bundleVersion`. **Never push, open pull requests, or post anything
to `bnfy/blanc`** unless the person working on the fork explicitly asks for
that exact action (for example "post the issue").

What still applies from `AGENTS.md`: how the code is built and why
(architecture, security posture, the tests and checks that guard each area).
Keep upstream's checks passing for every file a patch touches.

## Updating to a new upstream release

The fork only follows **published upstream releases** (tags `vX.Y.Z` with a
published, non-draft GitHub release), never upstream `main` and never
pre-releases. Update once per release; small, frequent updates have small
conflicts.

### Run it

```sh
fork/update.sh            # move onto the newest published release
fork/update.sh v1.50.0    # or onto a specific release tag
```

The script:

1. Checks the setup above, that you're on `personal`, and that the work tree is
   clean.
2. Finds the current base tag (`git describe`) and the target release.
3. Runs `fork/check.sh` on the current branch first, so a failure afterwards is
   known to come from the update. (`--skip-baseline` skips this.)
4. Tags the current branch as a local backup, `fork-backup/<old>-<timestamp>`.
5. Runs `git rebase --onto <new> <old> personal` with `rerere` on.
6. Stops on a conflict and prints what to do (below).
7. Shows `git range-diff` of every patch before and after, then runs
   `fork/check.sh` again.

After a conflict is resolved and `git rebase --continue` finishes, run
`fork/update.sh --verify` to get step 7.

### Resolving conflicts (agents and people)

For each conflicted file:

1. **Read what upstream changed first**:
   `git log -p <old>..<new> -- <file>`. Understand the upstream change before
   touching the conflict.
2. **Read the patch's record** in `fork/patches/`. It explains the patch's
   intent and its known conflict points.
3. **Keep upstream's change and re-apply the patch's intent on top.** Don't
   restore old upstream code to make a patch fit. If upstream restructured the
   code, move the hook to the equivalent new place.
4. If `rerere` replayed a previous resolution, read it before `git add`: a
   replayed resolution can be wrong for the new code.
5. Note anything non-obvious in the patch's record under "Known conflicts".

An agent resolves conflicts and fixes failing checks on its own, in a loop
(fix, re-run checks) until everything passes. It **stops and asks** only when:

- upstream shipped the patch's feature, or something that overlaps it, so
  the patch may no longer be needed (check its removal condition);
- upstream changed the behaviour the patch modifies so that keeping the
  patch is a product decision, not a code fix;
- checks still fail after several real attempts at a fix;
- a fix would need a change outside the patch's scope.

### After the update

1. Read the `range-diff` output: each patch should change only where upstream
   forced it to.
2. `fork/check.sh` passes.
3. Update the "Based on" line in `PATCHES.md`, and the "Last verified on"
   column for each patch, in the patch's own commit (squash with
   `--fixup`), or in patch 0000's commit for the "Based on" line.
4. Build, install and smoke-test (see Local builds).
5. Push: `git push --force-with-lease origin personal`. The rebase rewrites
   history, so a plain push is refused; `--force-with-lease` refuses to
   overwrite anything you haven't seen.
6. Backup tags are local only. Delete old ones when the new build has been
   used for a while: `git tag -l 'fork-backup/*'`, `git tag -d <tag>`.

To abandon an update: `git rebase --abort`, or
`git reset --hard fork-backup/<tag>` after it finished.

## Local builds

Not set up yet. A later patch will make local builds work: auto-update off,
signing with the self-signed "Blanc Personal Signing" certificate instead of
the owner's Developer ID, no notarization, and no provisioning profile (so no
Touch ID passkeys). Until that patch exists, don't run `npm run dist`; it
expects the owner's signing identity and fails.

## Sources for these practices

- Cohere, [Automating fork maintenance with AI agents](https://cohere.com/blog/automating-fork-maintenance-with-ai-agents):
  rebase onto release tags, test before and after, an agent loop that fixes
  until checks pass, upstream diffs as conflict context, propose fixes upstream.
- Brave, [Patching Chromium](https://github.com/brave/brave-core/blob/master/docs/patching_and_chromium_src.md):
  keep changes in your own files; patch upstream files minimally, as a last resort.
- [downstream-fork-maintain skill](https://github.com/xz-dev/downstream-fork-maintain-skill):
  each patch focused, tested and reviewable, with a recorded removal condition.
- Raine Virta, [Resolve merge conflicts with Claude Code](https://raine.dev/blog/resolve-conflicts-with-claude):
  read the target branch's changes before resolving.
