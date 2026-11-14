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

## Asking the user to run a command

When an agent needs the person to run a command (for example signing with
the personal certificate, or launching the app, which agent sandboxes can't
do), it must make the command one click to run where possible:

- **In T3 Code**, write it as a complete fenced code block with the language
  `sh` (or `bash`/`zsh`). T3 Code then shows a **Run in terminal** (play)
  button, which runs it in a T3 terminal at the project root, or at the
  thread's worktree when there is one. For the button to appear:
  - the fence language is `sh`, `bash`, `zsh`, `fish`, `shell`, `powershell` or `pwsh`;
  - the block is a single command or `&&`/`;` chain, with **no line ending in
    `\`** (use one long line, or a few separate lines, instead);
  - it has no control or invisible characters;
  - paths are relative to the repository root (that's where it runs), or
    absolute.
  Put each independent step in its own block, so each gets its own button.
- **Anywhere else**, a plain fenced code block with `sh` is fine.
- **Never chain an update with a build or install** (`fork/update.sh &&
  fork/build.sh …`): an update needs an agent's review first (see Updating).
- **Never tell the person to open a built `Blanc.app` directly** (Finder,
  `open`, Spotlight). It shares the installed app's ID and would use the real
  profile; test builds go through `fork/test-launch.sh`.

Say before the block what it does and what to expect, and ask for the output
if it fails.

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
| `fork/build.sh`, `fork/install.sh`, `fork/test-launch.sh` | Build, install, and test-launch with a throwaway profile (patch 0001) |
| `fork/build/` | Fork-only electron-builder config, entitlements and hooks (patch 0001) |
| `fork/test/` | Unit tests for the fork's patches (`node --test fork/test/*.test.js`) |
| `src/main/fork/` | Fork-only app code; upstream files only call into it |

Fork-only files live at the root (`FORK.md`, `PATCHES.md`), under `fork/` and
under `src/main/fork/`, which upstream does not use, so they never conflict.
Build output goes to `dist-local-personal.noindex/`, which upstream's
`.gitignore` already ignores (`dist-local*`); `.noindex` keeps Spotlight
from offering the built app.

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

**An update is always done by an agent, never by running the script alone.**
A rebase with no conflicts can still break a patch: git only checks that
lines don't overlap, so it can't see upstream renaming a function a patch
calls, moving the behaviour a patch hooks, or shipping the patch's feature.
Passing checks are necessary but not sufficient. So the person asks an
agent, for example:

> Update the fork to the latest upstream release, following FORK.md.

and builds and installs only after the agent's review is done (below).

### Run it (agents)

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
(fix, re-run checks) until everything passes, then does the review below. It **stops and asks** only when:

- upstream shipped the patch's feature, or something that overlaps it, so
  the patch may no longer be needed (check its removal condition);
- upstream changed the behaviour the patch modifies so that keeping the
  patch is a product decision, not a code fix;
- checks still fail after several real attempts at a fix;
- a fix would need a change outside the patch's scope.

### Review the update (agents, required even with no conflicts)

Before telling the person the update is ready:

1. **Read the `range-diff`.** Each patch should change only where upstream
   forced it to.
2. **Read upstream's changes around every hook.** For each file in a
   patch's "Hooks into upstream files" table:
   `git log -p <old>..<new> -- <file>`. Look for anything that changes what
   the hook relies on: renamed or moved functions, changed signatures, the
   same behaviour now handled elsewhere, a new code path that bypasses the
   hook.
3. **Read upstream's release notes** (`gh release view <new> -R bnfy/blanc`,
   and `docs/press/release-notes/` in the new tag) for features that overlap
   a patch or meet its removal condition.
4. **Run the checks:** `fork/check.sh`, the patch's own tests, and
   `npm run test:unit` and `npm run lint` (upstream's suite, to catch an
   upstream change that a patch breaks).
5. **Build:** `fork/build.sh --adhoc --skip-install-deps`. This runs every
   packaged-app verification.
6. **Update the records:** "Based on" in `PATCHES.md` (in patch 0000's
   commit), each patch's "Last verified on" and any "Known conflicts" (in that
   patch's commit, squashed with `--fixup`).
7. **Report to the person:** the new release, what upstream changed that
   touches the patches, what was adapted and why, anything that needs their
   decision, and what to check by hand in the app. Then give them the build
   and install block (see Local builds).

### After the review (the person)

1. Build and install: `fork/build.sh && fork/install.sh`, in one block.
2. Use the app and check what the agent's report lists.
3. Push (the agent can do this once you confirm):
   `git push --force-with-lease origin personal`. The rebase rewrites
   history, so a plain push is refused; `--force-with-lease` refuses to
   overwrite anything you haven't seen.
4. Backup tags are local only. Delete old ones when the new build has been
   used for a while: `git tag -l 'fork-backup/*'`, `git tag -d <tag>`.

To abandon an update: `git rebase --abort`, or
`git reset --hard fork-backup/<tag>` after it finished.

## Setting up another Mac

1. Install Git / Apple's Command Line Tools (`xcode-select --install` if
   missing), Node.js with npm, and authenticate Git access to the fork.
   The current build script targets Apple Silicon (`--arm64`).
2. Clone `https://github.com/itsfrank/blanc.git` and check out `personal`.
   Add the fetch-only upstream remote and apply every local Git setting in
   **Git setup** above. Run `git fetch upstream --tags` so the checks can
   identify the release base. Keep GitHub Actions disabled. Create the
   untracked private-words file (FORK.md rule 5) with the words to keep out,
   one extended regex per line; copy it from another clone rather than
   writing the list anywhere tracked:
   `$(git rev-parse --git-common-dir)/info/fork-private-words`.
3. Configure signing using **Per-machine signing** below: either import an
   existing encrypted .p12 (including its private key), or create a separate
   Code Signing certificate on this Mac. For a separate certificate, select
   its fingerprint with `git config --local blanc.signingIdentity <SHA1>`.
   Build and install both use this selection. A certificate's display name
   alone is not sufficient.
4. Export a password-protected .p12 backup including the private key; the
   convention on each Mac is `~/blanc-cert-backup/Certificates.p12`. Each
   machine's file may contain a different certificate. Store the password
   separately and keep both out of Git. `~` refers to the current Mac's user.
5. Install dependencies and run the fork checks:

   ```sh
   npm ci --no-audit --no-fund && fork/check.sh
   ```

6. If Blanc already has a profile here, quit it and back up
   `~/Library/Application Support/Blanc` before replacing the app. The fork
   shares the official app's ID and profile; a different signer can require
   Keychain approval. A Git clone and a signing certificate do not transfer
   browser data between Macs.
7. Build and install in your own Terminal:

   ```sh
   fork/build.sh && fork/install.sh
   ```

8. Check browsing, the dark Spectrum icon, the disabled updater message, and
   **Settings → Personal fork**. Configure machine-specific settings such as
   the go-link address locally. Never commit work hosts or credentials.

### Keeping two laptops in sync

Before working, commit or otherwise preserve local changes, then fetch:

```sh
git fetch origin --tags
```

With a clean tree, if `personal` is only behind `origin/personal`, use
`git merge --ff-only origin/personal`. If they diverge, ask an agent to compare
`git log --left-right --oneline personal...origin/personal` before integrating.
Updates and squashed patch fixes rewrite history: do not use a blind pull,
reset, or force push to resolve divergence. Preserve unpublished patches first.
The Git signing setting is clone-local and does not move between laptops.
Rebuild and install after integrating changes; the installed app does not
update itself. Follow the agent-reviewed upstream-update procedure above for
new upstream releases, not a merge of upstream main.

## Local builds

Set up by patch 0001 ([record](fork/patches/0001-local-builds.md)). Never run
`npm run dist`, `npm run dist:dir` or `npm run release`: they expect the
owner's signing identity and fail.

**Build and install (in your own Terminal):**

```sh
fork/build.sh      # npm ci, build, verify → dist-local-personal.noindex/mac-arm64/Blanc.app
fork/install.sh    # quit Blanc, install to /Applications, relaunch
```

`fork/install.sh` replaces the installed app and keeps no old copy (a second
`Blanc.app` with the same app ID could be opened against the real profile by
mistake). To roll back, check out an earlier commit or backup tag and build
and install again. Your profile (`~/Library/Application Support/Blanc`) is
never touched.

**Agents** can't use the signing certificate (their sandbox can't see the
login keychain), and can't launch the app (the sandbox blocks Chromium's Mach
port registration). They can do everything else:

```sh
fork/build.sh --adhoc --skip-install-deps   # same build, ad-hoc signature
fork/check.sh                               # every patch's checks
```

An ad-hoc build is for testing only: `fork/install.sh` refuses it, because
it would lose access to the "Blanc Safe Storage" Keychain item. To test-launch
any build without touching your profile, quit your Blanc and run in your own
Terminal (it refuses while Blanc is running, since two copies must never share
a profile):

```sh
fork/test-launch.sh
```

**What a personal build gives up:** Touch ID passkeys, protected playback
(Netflix, Spotify), the glass Icon Composer icons, and library validation.
Details and reasons are in the patch record.

**Per-machine signing:** build and install select the same SHA-1 fingerprint:
`BLANC_FORK_IDENTITY` environment override, then clone-local Git setting
`blanc.signingIdentity`, then the original certificate below. Only fingerprints
are accepted (or `-` for test builds); the installer always refuses ad-hoc
signatures and mismatched certificates. No private key is stored in Git.

To create a separate certificate on another Mac, open Keychain Access →
Certificate Assistant → Create a Certificate. Use a distinctive name such as
"Blanc Personal Signing - Personal Laptop", Identity Type **Self Signed Root**
and Certificate Type **Code Signing**. Store it in the login keychain, set its
Code Signing trust to **Always Trust**, and verify it appears in
`security find-identity -v -p codesigning`. Select its 40-character fingerprint
once per clone (replace the placeholder):

```sh
git config --local blanc.signingIdentity YOUR_40_CHARACTER_SHA1
```

The setting stays in `.git/config`, is never pushed, and survives rebases.
Keep the certificate and private key in this Mac's login keychain; export an
encrypted .p12 backup somewhere secure. Replacing the signer on an existing
profile may require Keychain approval and can affect encrypted-data access;
back up the profile first. Do not delete or reset "Blanc Safe Storage" to
silence an access failure.

**Original signing certificate:** "Blanc Personal Signing", self-signed, in the login
keychain, SHA-1 `4C8D41463A1DF570CF9DADABD28CC4AD8DDE5C5D`, trusted for Code
Signing. **Backup on the fork owner's Mac:** `~/blanc-cert-backup/`
(`Certificates.p12`, password-protected; the password is not stored in this
repository). To restore it after a Mac reset or a lost login keychain,
double-click the `.p12`, then set Code Signing to **Always Trust** for it in
Keychain Access. Restoring the same certificate keeps the same fingerprint, so
Blanc keeps access to "Blanc Safe Storage". Recreating it instead changes the
fingerprint; see the patch record.

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
