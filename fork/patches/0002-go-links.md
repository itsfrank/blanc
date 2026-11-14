# 0002: Go links (and the fork settings section)

| | |
|---|---|
| **Status** | Active |
| **Commit** | `fork(0002): go links` |
| **Added on base** | `v1.49.0` |
| **Upstream status** | Fork-only. Company short links are a niche feature; a general "short links" setting could be proposed upstream later. |
| **Remove when** | Upstream Blanc adds short-link / go-link support. The fork settings section stays as long as any fork setting exists. |

## Why

Work uses go links (`go/<name>`), normally handled by the Glean browser
extension, which Blanc can't run. The same build is used on a work Mac (go
links on) and a personal Mac (off), so the address is a **setting**, empty by
default, never a value built into the code.

This patch also introduces the fork's own **Settings → Personal fork**
section and the pattern every later fork setting follows
(FORK.md → "Adding a fork setting").

## Behaviour

With **Settings → Personal fork → Go link address** set, for example to
`https://example.glean.com/go/%s`:

| You do | Blanc opens |
|---|---|
| Type `go/foo` (or `go/foo/bar?x=1`) in the Island, press Enter | `https://example.glean.com/go/foo` (path, query and fragment kept, unescaped) |
| Type `go/` | `https://example.glean.com/go/` |
| Click or open a link to `http://go/foo` or `https://go/foo` (pages, `window.open`, redirects, every session, private tabs too) | `https://example.glean.com/go/foo` |

- Only the exact host `go`: `go.dev`, `golang.org`, `gopher/x`, `go:8080/x`
  and `go` alone are unchanged.
- A known bang wins: `!yt go/x` stays a YouTube search.
- `go/…` text is **never** sent to the search-suggestion provider, whether or
  not go links are on.
- **Empty address = off**: Blanc behaves exactly as upstream (apart from the
  suggestions rule above).
- The address must pass upstream's custom-search-address rules: `https://`
  (or `http://` on the local network), exactly one lowercase `%s` after the
  host, no username or password, at most 2048 characters. An invalid address
  is refused, the field shows an error, and the previous address stays.
- The setting is in `settings.json` like any other, so it follows Profile
  Sync if that is on. It is not in upstream's synced-keys list, so it stays
  on the device.

## Design

### Fork settings pattern (introduced here)

- `src/main/fork/settings.js`: `FORK_SETTINGS`, one entry per fork setting
  (`default`, `valid`, optional `normalize`). Exposes `FORK_DEFAULTS`,
  `readForkSettings(data)` (invalid stored value → default) and
  `sanitizeForkSettings(partial, clean)` (invalid write dropped).
- `src/renderer/pages/fork-settings.js`: builds the **Personal fork**
  section from `CARDS`. Each setting is `{ key, type, label, hint, error,
  placeholder }`; `type: 'url'` exists today. Main is the only validator: the
  field shows what was stored, and a refused draft stays with its error (the
  same model as upstream's custom search address).
- Strings: `fork.settings.*` in `copy/messages/en.json` and every
  translation (`de`, `es`, `fr`, `pt-BR`, `it`), acknowledged with
  `npm run copy:ack`, then `npm run copy:build` (which also regenerates the
  `strings.*.js` files and the mobile catalogs under `copy/generated/`).

### Go links

- `src/main/fork/go-links.js`: `rewriteTypedGoLink`, `redirectGoLinkRequest`,
  `isGoLinkText`, `installGoLinkRedirect`. Reads the setting on every use,
  so a change in Settings applies at once.
- `src/main/fork/request-redirects.js`: a small registry of browser-wide
  request redirects (main and sub frames only; a throwing rule is ignored).
  Upstream's blocking coordinator can only cancel through its veto, so the
  fork adds one redirect check right after it.

## Hooks into upstream files

| File | Where | Change |
|---|---|---|
| `src/main/settings.js` | end of `DEFAULTS` | `...require('./fork/settings').FORK_DEFAULTS` |
| `src/main/settings.js` | end of `getSettings()`, before `return data` | `readForkSettings(data)` |
| `src/main/settings.js` | end of `sanitize()`, before `return clean` | `sanitizeForkSettings(partial, clean)` |
| `src/renderer/pages/settings.html` | sidebar, after Help | `<a href="#group-fork" …>Personal fork</a>` |
| `src/renderer/pages/settings.html` | after `#group-help` | empty `<section id="group-fork">` |
| `src/renderer/pages/settings.html` | script list, before `settings-sync-setup-model.js` | `<script src="fork-settings.js">` (upstream's tests pin the order of the sync scripts and `settings.js`, so it must not sit between them) |
| `src/renderer/pages/settings.js` | right before "Settings sidebar: scroll-spy" | `window.blancForkSettings?.render(settings)` |
| `settings-schema/schema.json` | `internalDefaults` | `"goLinkTemplate"` |
| `copy/i18n-scope.json` | `files` | `fork-settings.js` as `guarded` |
| `copy/messages/*.json` | new keys | `fork.settings.*` (6 keys × 6 languages) |
| `src/main/main.js` | `navigateTabToAddress()`, after the bang lookup | typed `go/…` → `rewriteTypedGoLink` |
| `src/main/main.js` | `tabs:search` handler, after the bang lookup | a go link goes to `navigateTabToAddress` instead of the search engine. The Island usually submits `go/name` through its search row (`tabs:search`), not as an address, so this hook is required. |
| `src/main/main.js` | after `blockingCoordinator.setVeto(inertRequestVeto)` | `installGoLinkRedirect(...)` |
| `src/main/blocking-coordinator.js` | `onBeforeRequest`, right after the veto | `redirectFor(details)` → `{ redirectURL }` |
| `src/main/search-suggestions.js` | `isSuggestionEligible()`, first checks | `isGoLinkText(query)` → not eligible |

Generated by tools (never edit by hand; regenerate on conflict):
`src/renderer/pages/strings.*.js`, `copy/generated/**`
(`npm run copy:build`), and `security/audit-surface-inventory.json`
(`npm run audit-inventory:write`; only the `main.js` hash changes).

## Checks

- `fork/patches/0002-go-links.check.sh`: every hook above is present; the
  typed-text hook still runs after bangs and before address normalization;
  no real go-link address (`glean.com` other than `example.glean.com`) in
  the fork's changes (private words in general are the 0000 check's job); the fork and related upstream
  unit tests pass; `settings:check`, `copy:check` and
  `audit-inventory:check` pass.
- `fork/test/0002-go-links.test.js`: the rewrite and redirect (and inputs
  they must leave alone), "empty or invalid = off", suggestions refusal, the
  redirect registry, the coordinator redirecting before a blocker, fork
  settings read/write validation, every fork setting having a UI entry,
  strings in every language and a schema key, and the Settings section
  rendering and refusing an invalid address.
- `fork/test/desktop/0002-go-links-smoke.mjs` (run by the person:
  `node fork/test/desktop/run.mjs`): in the real dev app, typed `go/engine`
  and `go/foo/bar?x=1` open the go-link address; `go.dev/x` and `!yt go/x`
  are unchanged; a clicked `http://go/…` link is redirected; Settings →
  Personal fork refuses an invalid address and keeps the working one;
  clearing the address makes `go/engine` a search again. 7/7 passed on
  `v1.49.0` and on `v1.49.1`, 2026-11-16.
- By hand, in the installed app: set the address in Settings → Personal
  fork; type `go/<a real link>`; click a `go/` link (for example in Slack or a
  doc); check `go.dev` still opens normally; clear the address and check
  `go/foo` becomes a search again.

## Known conflicts

- **v1.49.0 → v1.49.1:** conflicts in `copy/messages/*.json` and every
  generated strings file (`strings.*.js`, `copy/generated/**`), in
  `settings-schema/schema.json` (upstream added `reuseNewTab` to
  `internalDefaults`, #1542) and in `security/audit-surface-inventory.json`.
  Resolved by taking upstream's files, re-adding the six `fork.settings.*`
  keys in every catalog from the fork commit, re-adding `goLinkTemplate` to
  `internalDefaults`, then `npm run copy:build` and
  `npm run audit-inventory:write`. The translations stayed current (their
  English source didn't change), so no `copy:ack` was needed. Every code
  hook applied cleanly.
- **v1.49.1 → v1.50.0:** the same files conflicted the same way (upstream
  added catalog keys at the end of each file and `askWhereToSave` to
  `internalDefaults`, #1591), resolved the same way. Upstream's new Local
  Network Access gate in `blocking-coordinator.js` (#1593) runs after the
  go-link redirect hook; the redirected request passes through the gate
  again, so nothing bypasses it.

## Bugs found

- **v1.49.0, first install:** typed `go/engine` went to the search engine.
  The Island treats `go/name` as search text (it isn't address-shaped), so
  Enter submits its search row through `tabs:search`, which had no hook; only
  the address path (`navigateTabToAddress`) did. Fixed by the `tabs:search`
  hook; a test now pins both paths.

## Likely conflict spots


- `src/main/settings.js` around the end of `DEFAULTS`, `getSettings()` and
  `sanitize()`: keep each hook as the last statement before the return (or
  the last entry in `DEFAULTS`).
- `src/renderer/pages/settings.html`: upstream adds a sidebar link or
  section. Keep the fork's link and section last.
- `copy/messages/*.json` and the generated `strings.*.js`: take upstream's
  files, re-add the `fork.settings.*` entries, run `copy:ack` for the five
  translations and `copy:build`.
- `security/audit-surface-inventory.json`: take upstream's, then
  `npm run audit-inventory:write`.

## Configuration

Set in **Settings → Personal fork → Go link address** on each Mac that uses
go links. Never committed. Empty on a Mac without go links.
