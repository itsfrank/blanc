# 0001: Local builds

| | |
|---|---|
| **Status** | Active |
| **Commit** | `fork(0001): local builds` |
| **Added on base** | `v1.49.0` |
| **Upstream status** | Fork-only, never proposed (upstream builds are notarized releases) |
| **Remove when** | Never, while the fork is built locally. It is the fork's build setup, not a feature. |

## Why

Upstream's build needs the owner's Apple Developer ID certificate,
provisioning profile, notarization account and Xcode. A personal build has
none of those, and an official update must never replace it.

## Behaviour

- **Auto-update is off.** The updater never checks or downloads. Blanc →
  **Check for Updates** shows "Updates are disabled for this launch" with the
  detail "This is a personal Blanc build. Update it by rebuilding from the
  fork (fork/update.sh)." (upstream's existing disabled-updates dialog, so no
  new interface text or translations).
- **App icon: dark Sunrise Spectrum** everywhere macOS draws the app's own
  icon: Finder, Dock (running or not), Launchpad, Spotlight, ⌘-Tab,
  notifications. Settings → App icon still shows **Sunrise** as selected;
  that's expected (with "Sunrise" selected, Blanc shows the bundle icon, which
  is now Spectrum). Picking another icon there shows its flat PNG instead.
- **Signed with "Blanc Personal Signing"**, so the app keeps one identity
  across rebuilds and its "Blanc Safe Storage" Keychain item stays readable.
- **Same app ID, name and profile folder as upstream** (`me.bnfy.bowser`,
  "Blanc", `~/Library/Application Support/Blanc`).

What this build gives up, by design:

- **Touch ID passkeys**: the `keychain-access-groups` entitlement needs the
  owner's provisioning profile.
- **Protected playback** (Netflix, Spotify): this is the plain npm Electron,
  not castLabs' Widevine runtime, which needs their VMP signing.
- **Glass Icon Composer icons**: the build has no `Assets.car`, so every icon
  choice is a flat PNG.
- **Library validation** is off in every process (see Design).

## Design

All build changes live in fork files; upstream's build config is reused, not
copied.

- `fork/build/electron-builder.cjs`: spreads `package.json`'s `build`
  config and overrides only:
  - `mac.identity` (the personal certificate's SHA-1, or `-` for ad-hoc via
    `BLANC_FORK_IDENTITY`; optional `BLANC_FORK_KEYCHAIN` for test keychains);
  - `mac.notarize: false`, `mac.provisioningProfile: undefined`;
  - `mac.entitlements` and `mac.entitlementsInherit` → the fork plists;
  - `mac.icon` → `src/renderer/pages/icon-sunrise-spectrum-dark.png` (becomes
    `icon.icns`; no Icon Composer catalog);
  - `mac.target: ['dir']`, `publish: null` (no `app-update.yml`);
  - `extraMetadata.blancPersonalBuild: true` (stamped into the packaged
    `package.json`; turns the updater off);
  - `afterPack` / `afterSign` → the fork wrappers.
- `fork/build/entitlements.mac.plist`: upstream's main-app entitlements
  without `keychain-access-groups`, `com.apple.application-identifier` and
  `com.apple.developer.team-identifier`, plus
  `com.apple.security.cs.disable-library-validation`.
- `fork/build/entitlements.mac.inherit.plist`: upstream's helper entitlements
  plus `disable-library-validation`. The Plugin helper still gets upstream's
  `build/entitlements.mac.plugin.plist` through `scripts/sign-mac.js`.
  - **Why library validation is off:** a self-signed or ad-hoc signature has
    no Apple Team ID, and under the hardened runtime macOS then refuses to
    load the app's own `Electron Framework` ("mapping process and mapped file
    have different Team IDs"). Found on the first build, which crashed at
    launch. The hardened runtime's other protections stay on.
- `fork/build/after-pack.cjs`: runs every verification upstream's
  `scripts/after-pack-app-icons.js` runs (blocker lists, uBO payload, capture
  runtime, licence compliance, browser role) and skips only its Xcode `actool`
  icon compile. It **fails the build** if upstream's list of verifications
  changes, so it can't silently fall behind.
- `fork/build/after-sign.cjs`: replaces upstream's Developer ID / profile
  check. Requires a strict deep signature, the expected signer, no restricted
  entitlements, and JIT, media and library-validation entitlements on every
  bundle.
- `src/main/fork/personal-build.js`: returns a disabled updater policy when
  the packaged `package.json` has `blancPersonalBuild: true`; otherwise
  `null`, so `npm start` and upstream's tests behave exactly as upstream.
- `fork/build.sh`: `npm ci`, upstream's `brand:check` and
  `icons:windows:check` (its `predist` minus the Developer ID preflight),
  electron-builder into `dist-local-personal.noindex/` (already ignored by
  upstream's `.gitignore` `dist-local*`; `.noindex` keeps Spotlight from
  indexing the built app, which shares the installed app's ID), unregisters
  the built app from Launch Services, then this patch's check on the built app.
  `--adhoc` builds without the certificate (agents can do this);
  `--skip-install-deps` skips `npm ci`.
- `fork/test-launch.sh`: runs a built app with a throwaway profile and
  `--use-mock-keychain`; refuses while the installed Blanc is running.
- `fork/install.sh`: refuses an app not signed by the personal certificate
  (an ad-hoc one would lose Keychain access), quits Blanc, replaces the app
  with `ditto` (no old copy kept, so no second same-ID app), relaunches.

## Hooks into upstream files

| File | Where | Change |
|---|---|---|
| `src/main/updater-policy.js` | `resolveUpdaterPolicy()`, right after the `!isPackaged` line | One line: return `personalBuildPolicy(disabled)` when it isn't `null` |

## Checks

- `fork/patches/0001-local-builds.check.sh` (run by `fork/check.sh`):
  - the fork config resolves, keeps upstream's app ID, name, files,
    `beforePack`, signer and hardened runtime, and has the personal overrides;
  - the fork entitlements equal upstream's minus the restricted keys plus
    `disable-library-validation` (fails if upstream changes its plists);
  - `after-pack.cjs` still matches upstream's verifications;
  - the `updater-policy.js` hook is present;
  - `fork/test/0001-local-builds.test.js` and upstream's updater tests pass.
- With `--app <Blanc.app>` (run by `fork/build.sh`) it also checks the built
  app: bundle ID, `icon.icns` and no `Assets.car`/`CFBundleIconName`, no
  provisioning profile, no `app-update.yml`, `blancPersonalBuild` in the
  packaged `package.json`, and a valid signature.
- By hand after a build (verified on `v1.49.0`, ad-hoc build, by the fork's
  owner): the app launches with a throwaway profile, the Dock shows dark
  Spectrum, and Check for Updates shows the personal-build message.
  Agents can't launch the app: their sandbox blocks Chromium's Mach port
  registration (`bootstrap_check_in … Permission denied`). Test launch, in
  your own Terminal:

  ```sh
  fork/test-launch.sh
  ```

## Known conflicts

None yet. Likely spots:

- `src/main/updater-policy.js` near the `!isPackaged` line, if upstream
  restructures the policy. Keep the hook as the first check after it.
- Upstream changing `scripts/after-pack-app-icons.js`'s verifications or
  `build/entitlements.mac*.plist`: the check fails by design; update
  `fork/build/after-pack.cjs` or the fork plists to match.

## Configuration

- Signing selection is shared by config, build and install through
  `fork/build/identity.cjs`: `BLANC_FORK_IDENTITY` overrides clone-local
  `git config --local blanc.signingIdentity <SHA1>`, then the original default.
  Only full SHA-1 fingerprints (or `-` for tests) are accepted. Installation
  rejects ad-hoc and mismatched signatures, with no bypass. Certificate creation
  and backup instructions are in `FORK.md`.
- Original default signing identity: `4C8D41463A1DF570CF9DADABD28CC4AD8DDE5C5D`
  ("Blanc Personal Signing", self-signed, login keychain; backup at
  `~/blanc-cert-backup/Certificates.p12` on the fork owner's Mac). Override with
  `BLANC_FORK_IDENTITY`. If the certificate is recreated, select its new
  fingerprint in clone-local Git config rather than editing tracked defaults.
  Existing profiles may require Keychain approval; encrypted-data continuity
  must be checked on the affected machine.
