# PATCHES.md

The patches this fork carries on top of upstream
[bnfy/blanc](https://github.com/bnfy/blanc), in the order they apply. Rules and
the update runbook are in [`FORK.md`](FORK.md).

**Based on:** `v1.50.0` (`3edf12275`)

## Active

| ID | Patch | Upstream files touched | Checks | Upstream status | Remove when | Last verified on |
|---|---|---|---|---|---|---|
| [0000](fork/patches/0000-fork-scaffolding.md) | Fork scaffolding: these docs, the update script, and a pointer in the agent files | `AGENTS.md`, `CLAUDE.md` (one block at the top of each) | `0000-fork-scaffolding.check.sh` | Fork-only, never proposed | Never (the fork's own tooling) | `v1.50.0` |
| [0001](fork/patches/0001-local-builds.md) | Local builds: auto-update off, personal signing, no notarization or provisioning profile, dark Sunrise Spectrum app icon | `src/main/updater-policy.js` (one line) | `0001-local-builds.check.sh`, `fork/test/0001-local-builds.test.js` | Fork-only, never proposed | Never, while the fork is built locally | `v1.50.0` |
| [0002](fork/patches/0002-go-links.md) | Go links (`go/<name>` → a configurable address) and the **Settings → Personal fork** section | `src/main/settings.js` (3 lines), `main.js` (3), `blocking-coordinator.js` (1), `search-suggestions.js` (1), `pages/settings.html` (3), `pages/settings.js` (1), `settings-schema/schema.json`, `copy/i18n-scope.json`, `copy/messages/*.json` (+ generated) | `0002-go-links.check.sh`, `fork/test/0002-go-links.test.js` | Fork-only | Upstream adds short-link support | `v1.50.0` |

## Retired

Patches no longer carried. Their IDs are never reused, and their records stay
in `fork/patches/` with the reason they were removed.

| ID | Patch | Removed in base | Why |
|---|---|---|---|
| [0003](fork/patches/0003-local-network-access.md) | Local network access allowlist (Okta Verify FastPass) | `v1.50.0` | Upstream bnfy/blanc#1593, released in `v1.50.0`, prompts per site for Local Network Access |

## Adding a patch

1. Take the next free ID (highest ID in both tables + 1).
2. Copy `fork/patches/TEMPLATE.md` to `fork/patches/NNNN-<slug>.md` and fill
   it in, including when to remove it.
3. Add its row above, and a `fork/patches/NNNN-<slug>.check.sh` if it can be
   checked quickly.
4. Commit the code, record and row together as one commit:
   `fork(NNNN): <short description>`.
