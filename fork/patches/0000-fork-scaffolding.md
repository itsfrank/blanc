# 0000: Fork scaffolding

| | |
|---|---|
| **Status** | Active |
| **Commit** | `fork(0000): fork scaffolding` |
| **Added on base** | `v1.49.0` |
| **Upstream status** | Fork-only, never proposed |
| **Remove when** | Never. This is the fork's own tooling; it goes only if the fork is abandoned. |

## Why

The fork needs its own rules, a patch list and an update procedure, and agents
working in the checkout must learn they are in a personal fork before they
follow upstream's release-focused `AGENTS.md`.

## Behaviour

No change to the app. Adds documentation and scripts only.

## Design

- `FORK.md`: the fork's rules, git setup and update runbook.
- `PATCHES.md`: the ordered patch list.
- `fork/patches/`: one record per patch, `TEMPLATE.md`, and per-patch checks.
- `fork/update.sh`: rebases `personal` onto a newer release tag (baseline
  checks, backup tag, rebase, range-diff, checks).
- `fork/check.sh`: runs every `fork/patches/*.check.sh`.

All of these are new files in paths upstream doesn't use, so they never
conflict. None are packaged into the app (`build.files` only takes `src/**`
and a few named files).

## Hooks into upstream files

| File | Where | Change |
|---|---|---|
| `AGENTS.md` | Right after the `# AGENTS.md` heading | A blockquote telling agents to read `FORK.md` first and that it wins on conflict |
| `CLAUDE.md` | Right after the `# CLAUDE.md` heading | The same blockquote |

The block deliberately names no domains or upstream rules, because upstream's
unit tests scan these two files (for example `test/unit/site-domain.test.js`,
`test/unit/public-truth.test.js`, `test/unit/whats-new-runbook.test.js`).

## Checks

`0000-fork-scaffolding.check.sh`: the docs and scripts exist, both agent files
keep the pointer at the top, every listed patch has a record with a removal
condition, and the `upstream` push URL is still disabled. It also scans every
line the fork adds on top of its base tag, every fork commit message and the
local branch names for the private words in the untracked per-clone file
`$(git rev-parse --git-common-dir)/info/fork-private-words` (FORK.md rule 5),
and warns if that file is missing. The word list is private, so it is never
committed.

## Known conflicts

- `AGENTS.md` and `CLAUDE.md` change in almost every upstream release. Their
  edits are usually far below the top, so the block at the top rarely
  conflicts. If it does, take upstream's version of the file and put the block
  back right after the first heading.

## Configuration

None.
