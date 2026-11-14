#!/usr/bin/env bash
# 0001 local builds.
#   fork/patches/0001-local-builds.check.sh               static checks + unit tests
#   fork/patches/0001-local-builds.check.sh --app <.app>  also inspect a built app
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "0001: $*" >&2; exit 1; }

app=""
if [ "${1:-}" = --app ]; then app="${2:?--app needs a path}"; fi

# Config resolves and keeps upstream's settings, with the personal overrides.
node -e '
const c = require("./fork/build/electron-builder.cjs");
const up = require("./package.json").build;
const a = (ok, m) => { if (!ok) { console.error("0001: " + m); process.exit(1); } };
a(c.appId === up.appId && c.productName === up.productName, "appId/productName must stay upstream (same profile folder)");
a(c.mac.notarize === false, "notarize must be false");
a(c.mac.provisioningProfile === undefined, "no provisioning profile");
a(c.publish === null, "publish must be null");
a(c.extraMetadata && c.extraMetadata.blancPersonalBuild === true, "extraMetadata.blancPersonalBuild missing");
a(c.mac.icon === "src/renderer/pages/icon-sunrise-spectrum-dark.png", "icon must be dark Sunrise Spectrum");
a(require("fs").existsSync(c.mac.icon), "icon file missing: " + c.mac.icon);
a(c.mac.sign === up.mac.sign && c.mac.hardenedRuntime === up.mac.hardenedRuntime, "signer/hardened runtime must stay upstream");
a(c.beforePack === up.beforePack, "beforePack must stay upstream");
a(JSON.stringify(c.files) === JSON.stringify(up.files), "files allowlist must stay upstream");
' || exit 1

# Entitlements: upstream's, minus the restricted Touch ID keys, plus
# disable-library-validation (needed without an Apple Team ID).
node -e '
const fs = require("fs");
const keys = (f) => [...fs.readFileSync(f, "utf8").matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]);
const restricted = ["keychain-access-groups", "com.apple.application-identifier", "com.apple.developer.team-identifier"];
const lv = "com.apple.security.cs.disable-library-validation";
const same = (a, b) => [...new Set(a)].sort().join(",") === [...new Set(b)].sort().join(",");
for (const [up, fork, drop] of [["build/entitlements.mac.plist", "fork/build/entitlements.mac.plist", restricted], ["build/entitlements.mac.inherit.plist", "fork/build/entitlements.mac.inherit.plist", []]]) {
  const want = [...keys(up).filter((k) => !drop.includes(k)), lv];
  if (!same(want, keys(fork))) { console.error("0001: " + fork + " drifted from " + up + ":\n  want: " + want.sort() + "\n  got:  " + keys(fork).sort()); process.exit(1); }
}
' || exit 1
plutil -lint -s fork/build/entitlements.mac.plist fork/build/entitlements.mac.inherit.plist || fail "fork entitlements plist invalid"

# afterPack wrapper still matches upstream's verifications.
node -e 'const m = require("./fork/build/after-pack.cjs"); if (m.upstreamCalls().join() !== m.EXPECTED_CALLS.join()) { console.error("0001: upstream after-pack verifications changed: " + m.upstreamCalls().join(", ")); process.exit(1); }' || exit 1

# Updater hook is in place.
grep -q "require('./fork/personal-build').personalBuildPolicy(disabled)" src/main/updater-policy.js \
  || fail "src/main/updater-policy.js lost its fork(0001) hook"

bash -n fork/build.sh fork/install.sh fork/test-launch.sh || fail "script syntax error"

# Unit tests: the fork's own, plus upstream's tests for the touched areas.
node --test fork/test/*.test.js test/unit/updater-policy.test.js test/unit/updater.test.js \
  test/unit/updater-flatpak.test.js test/unit/updater-staging-runtime.test.js test/unit/ecs-updater-policy.test.js \
  >/tmp/blanc-fork-0001-tests.log 2>&1 || { tail -40 /tmp/blanc-fork-0001-tests.log; fail "unit tests failed (log: /tmp/blanc-fork-0001-tests.log)"; }

[ -n "$app" ] || exit 0

# ---- Built-app checks ----
[ -d "$app" ] || fail "no app at $app"
plist="$app/Contents/Info.plist"
[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$plist")" = me.bnfy.bowser ] || fail "bundle id changed"
[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIconFile' "$plist")" = icon.icns ] || fail "CFBundleIconFile is not icon.icns"
if /usr/libexec/PlistBuddy -c 'Print CFBundleIconName' "$plist" >/dev/null 2>&1; then fail "CFBundleIconName set (an Assets.car icon would override the flat icon)"; fi
[ ! -e "$app/Contents/Resources/Assets.car" ] || fail "unexpected Assets.car"
[ ! -e "$app/Contents/embedded.provisionprofile" ] || fail "unexpected provisioning profile"
[ ! -e "$app/Contents/Resources/app-update.yml" ] || fail "unexpected app-update.yml (updater feed)"
node -e '
const { extractFile } = require("@electron/asar");
const meta = JSON.parse(extractFile(process.argv[1] + "/Contents/Resources/app.asar", "package.json").toString());
if (meta.blancPersonalBuild !== true) { console.error("0001: packaged package.json lacks blancPersonalBuild"); process.exit(1); }
' "$app" || exit 1
codesign --verify --deep --strict "$app" || fail "signature does not verify"
echo "0001: built app ok ($app)"
