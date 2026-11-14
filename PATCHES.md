# PATCHES.md

The patches this fork carries on top of upstream
[bnfy/blanc](https://github.com/bnfy/blanc), in the order they apply. Rules and
the update runbook are in [`FORK.md`](FORK.md).

**Based on:** `v1.49.0` (`ac3d6d96`)

## Active

| ID | Patch | Upstream files touched | Checks | Upstream status | Remove when | Last verified on |
|---|---|---|---|---|---|---|
| [0000](fork/patches/0000-fork-scaffolding.md) | Fork scaffolding: these docs, the update script, and a pointer in the agent files | `AGENTS.md`, `CLAUDE.md` (one block at the top of each) | `0000-fork-scaffolding.check.sh` | Fork-only, never proposed | Never (the fork's own tooling) | `v1.49.0` |

## Retired

Patches no longer carried. Their IDs are never reused, and their records stay
in `fork/patches/` with the reason they were removed.

| ID | Patch | Removed in base | Why |
|---|---|---|---|
| — | — | — | — |

## Adding a patch

1. Take the next free ID (highest ID in both tables + 1).
2. Copy `fork/patches/TEMPLATE.md` to `fork/patches/NNNN-<slug>.md` and fill
   it in, including when to remove it.
3. Add its row above, and a `fork/patches/NNNN-<slug>.check.sh` if it can be
   checked quickly.
4. Commit the code, record and row together as one commit:
   `fork(NNNN): <short description>`.
