# NNNN: <patch name>

| | |
|---|---|
| **Status** | Active / Retired in `vX.Y.Z` |
| **Commit** | `fork(NNNN): <subject>` |
| **Added on base** | `vX.Y.Z` |
| **Upstream status** | Fork-only / Proposed in bnfy/blanc#NNN / Merged in bnfy/blanc#NNN, released in `vX.Y.Z` |
| **Remove when** | <a condition anyone can check, for example "an upstream release includes bnfy/blanc#NNN" or "upstream adds a setting for X"> |

## Why

<What the patch does for the person using the fork, and why upstream doesn't
already provide it.>

## Behaviour

<What changes, exactly, from the user's point of view. Include edge cases and
what deliberately does not change.>

## Design

<How it works. New files the patch adds, and why the logic lives there.>

## Hooks into upstream files

<Every upstream file the patch edits, with the function or line it hooks, and
why there. Keep this list short; each entry is a likely conflict.>

| File | Where | Change |
|---|---|---|
| `src/main/main.js` | `functionName()` | One-line call to `src/main/fork/<slug>.js` |

## Checks

<The unit tests and the `NNNN-<slug>.check.sh` that prove the patch still
works, and anything that needs checking by hand in a built app.>

## Known conflicts

<Upstream changes that have conflicted with this patch, and how they were
resolved. Add an entry after any update that needed a non-obvious fix.>

## Configuration

<Any local, untracked configuration the patch reads (never commit private
values), and its default when absent.>
