# 0003: Local network access allowlist

| | |
|---|---|
| **Status** | Retired in `v1.50.0` |
| **Commit** | `fork(0003): local network access allowlist` |
| **Added on base** | `v1.49.1` |
| **Upstream status** | Proposed in bnfy/blanc#1585 (closed); fixed upstream by bnfy/blanc#1593 (a per-site Allow/Block prompt), released in `v1.50.0` |
| **Remove when** | Upstream Blanc lets sites use Local Network Access (prompt or setting) so Okta FastPass works |

## Retired

Removed when the fork moved to `v1.50.0`, which includes bnfy/blanc#1593:
the first time a site asks for Local Network Access, Blanc shows an
Allow/Block prompt, remembers the answer per site (Settings → Privacy → Site
permissions), and `navigator.permissions.query` reads `prompt` instead of
`denied` for an undecided site. The commit and its code are gone from
`personal`; this record stays for reference. The old setting
`localNetworkAccessSites` may remain in `settings.json` and is ignored.
Okta Verify FastPass was checked with upstream's prompt in a local `v1.50.0`
build before retiring the patch, and it worked.

## Why

Okta Verify FastPass fails in Blanc with "The browser is blocking
communication with Okta Verify… change 'Local network access' from Block to
Allow". The sign-in page talks to Okta Verify's service on `localhost`, which
Chromium gates behind its **Local Network Access** permissions. Upstream's
permission policy (`src/main/permissions.js`) auto-allows three permissions,
prompts for three, and silently denies everything else, in both the request
handler and the check handler. Chromium 156 / Electron 45.2.1 names the Local
Network Access permissions `local-network-access`, `local-network` and
`loopback-network`; all three are in the "everything else" tier. On an Okta
page, `navigator.permissions.query` returns `denied` for all three (even with
`--disable-features=LocalNetworkAccessChecks`), because Blanc's check handler
answers false, and Okta gives up before it tries to connect.

## Behaviour

**Settings → Personal fork → Local network access**: a list of sites, one per
line, empty by default.

| Entry | Matches | Doesn't match |
|---|---|---|
| `login.example.com` | `https://login.example.com` (any port) | `https://a.login.example.com`, `http://login.example.com` |
| `*.example.okta.com` | `https://a.example.okta.com`, `https://a.b.example.okta.com` | `https://example.okta.com` itself |
| `127.0.0.1`, `localhost` | also `http://` (loopback only) | — |

- A listed site's requests and checks for the three Local Network Access
  permissions are **allowed with no prompt**, and
  `navigator.permissions.query` reads `granted`.
- A site not listed is exactly as upstream: denied, no prompt.
- Every other permission is unaffected.
- The requesting origin must be `https:` (or `http:` on a loopback host,
  so the end-to-end test can serve locally), with no username or password.
- The held-view firewall (a closed tab parked for Reopen Closed Tab) still
  denies first.
- **Empty list = upstream behaviour.**
- Applies to every profile and to private tabs (the setting is device-level,
  like all of `settings.json`; it's not in upstream's synced keys).

**Pattern grammar.** An exact hostname (or IPv4 address), or `*.` followed by
a domain of at least two labels. A wildcard matches subdomains only, not the
bare domain, like Chrome's `[*.]` being opt-in: listing `example.com` and
`*.example.com` is explicit about both. Entries are trimmed, lowercased,
converted to punycode, a trailing dot dropped, and deduplicated; at most 50.
Refused: a scheme, path, port, `@`, spaces, IPv6, a bare `*`, a `*` anywhere
but a leading `*.`, a wildcard over one label (`*.com`) or over an IP address.
Public suffixes with two labels (`*.co.uk`) can't be told apart without the
public-suffix list and are accepted; that's the user's choice to make.

## Design

- `src/main/fork/local-network-access.js` (no Electron): `LNA_PERMISSIONS`,
  `normalizePattern`, `normalizeSites`, `validSites`, and
  `allowsLocalNetwork(permission, rawOrigin, getPatterns)`. `getPatterns`
  defaults to `settings.getSettings().localNetworkAccessSites`, read at each
  call (a change in Settings applies at once) and required lazily, so
  `permissions.js` still loads under plain `node --test`. It's only called
  for the three LNA permissions.
- **Why an allowlist and not a prompt.** Electron's check handler is boolean,
  so an undecided permission always reads `denied` from
  `permissions.query`, never `prompt`. Adding the permissions to `PROMPTED`
  would still fail Okta on first visit, because it reads the state before it
  asks. An explicit allowlist, modelled on Chrome's enterprise policy
  `LocalNetworkAccessAllowedForUrls`, answers `granted` from the first visit
  and keeps every other site denied.
- **Stored as an array** (`localNetworkAccessSites: ["example.okta.com"]`):
  upstream's settings layer already stores arrays (`adblockExceptions`), so
  no string format is needed. `valid()` accepts a list whose every non-empty
  entry is a valid pattern (≤ 50 after deduplication); blank entries are
  dropped by `normalize()`. A write with any invalid entry is refused whole and
  the previous list stays, like the go-link address.
- Settings UI: a new `sites` builder in `src/renderer/pages/fork-settings.js`,
  a textarea, one pattern per line. Main is the only validator; a refused
  draft stays in the field with its error. (A refusal is detected as "stored
  list unchanged while the draft differs".)
- Strings: `fork.settings.localNetwork.{title,label,hint,error}` in every
  catalog, acknowledged with `copy:ack`, then `copy:build`.

## Hooks into upstream files

| File | Where | Change |
|---|---|---|
| `src/main/permissions.js` | `setPermissionRequestHandler`, the line right after `heldRequester(wc)` | `allowsLocalNetwork(permission, details?.requestingUrl)` → `callback(true)` |
| `src/main/permissions.js` | `setPermissionCheckHandler`, the line right after `heldRequester(wc)` | `allowsLocalNetwork(permission, requestingOrigin)` → `true` |
| `src/main/capture-runtime-lock.json` | `sharedFiles["src/main/permissions.js"]` | the new SHA-256 of `permissions.js`. Upstream pins it so a permission change can't reach capture silently; reviewed: only the three LNA permissions change, `media` and `display-capture` don't |
| `settings-schema/schema.json` | `internalDefaults` | `"localNetworkAccessSites"` |
| `copy/messages/*.json` | new keys | `fork.settings.localNetwork.*` (4 keys × 6 languages) |

Generated by tools (never edit by hand; regenerate on conflict):
`src/renderer/pages/strings.*.js`, `copy/generated/**` (`npm run copy:build`),
and `security/audit-surface-inventory.json` (`npm run audit-inventory:write`;
only the `permissions.js` hash changes).

## Checks

- `fork/patches/0003-local-network-access.check.sh`: both hooks present by
  fixed string, each the line right after its handler's `heldRequester`
  check; the schema key and the UI entry exist; Electron's typings still name
  the three permissions; the end-to-end test parses; the fork's and upstream's
  permission and capture-lock unit tests pass; `settings:check`, `copy:check` and `audit-inventory:check` pass.
  The 0002 check's scan for work-specific text covers this patch too.
- `fork/test/0003-local-network-access.test.js`: pattern validation and
  canonicalization, the size cap, read/write validation, host matching
  (wildcards never match the bare domain or look-alikes), scheme and
  credential rules, non-LNA permissions unaffected, an unlisted origin
  denied, an empty list denied, the held view still denied (through a fake
  session in `permissions.js`), hook order, and the Settings card.
- `fork/test/desktop/0003-local-network-access-smoke.mjs` (run by the person:
  `node fork/test/desktop/run.mjs 0003`): with `127.0.0.1` listed, a page on
  a local server reads `granted` for all three permissions; the same server
  as `localhost` reads `denied`; Settings refuses an invalid list and keeps
  the old one; clearing the list denies `127.0.0.1` at once.
- By hand, in the installed app: add the Okta host in Settings → Personal
  fork → Local network access and sign in with Okta Verify FastPass.

## Known conflicts

None yet. Expected on the next update: bnfy/blanc#1593 changes how
`src/main/permissions.js` handles Local Network Access, so this patch's hooks
will likely conflict there. Don't resolve that conflict; drop the patch
instead (move it to Retired) once FastPass works with upstream's prompt.

## Likely conflict spots

- `src/main/permissions.js`: upstream changes either handler's first lines.
  Keep each hook as the line right after the `heldRequester` check. If
  upstream adds its own Local Network Access handling (a prompt or setting),
  check the removal condition.
- `copy/messages/*.json`, `strings.*.js`, `copy/generated/**`: as in 0002,
  take upstream's, re-add the `fork.settings.localNetwork.*` entries, then
  `copy:ack` and `copy:build`.
- `settings-schema/schema.json` `internalDefaults`: re-add the key.
- `src/main/capture-runtime-lock.json`: whenever upstream or this patch changes
  `permissions.js`, take upstream's lock, then set the `permissions.js` pin to
  `shasum -a 256 src/main/permissions.js` (after reviewing the change). Same
  for the hash in `security/audit-surface-inventory.json`
  (`npm run audit-inventory:write`).

## Configuration

**Settings → Personal fork → Local network access**, per Mac. Put the work
sign-in host (for example the exact tenant host, or `*.okta.com`) there,
never in the repository. Empty by default.
