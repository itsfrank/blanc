#!/usr/bin/env bash
# fork(0001): build the personal Blanc app into dist-local-personal.noindex/.
#
#   fork/build.sh            sign with "Blanc Personal Signing" (run in your own Terminal)
#   fork/build.sh --adhoc    ad-hoc signature, no certificate (agents, CI-like checks)
#   fork/build.sh --skip-install-deps   don't run npm ci
#
# Output: dist-local-personal.noindex/mac-arm64/Blanc.app. Install it with fork/install.sh.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

adhoc=0
install_deps=1
for arg in "$@"; do
  case "$arg" in
    --adhoc) adhoc=1 ;;
    --skip-install-deps) install_deps=0 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "fork/build.sh: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ "$(uname -s)" = Darwin ] || { echo "fork/build.sh: macOS only" >&2; exit 1; }

if [ "$adhoc" = 1 ]; then
  export BLANC_FORK_IDENTITY=-
else
  export BLANC_FORK_IDENTITY="$(node fork/build/identity.cjs)"
  if [ "$BLANC_FORK_IDENTITY" != - ] && [ -z "${BLANC_FORK_KEYCHAIN:-}" ] \
     && ! security find-identity -v -p codesigning | grep -q "$BLANC_FORK_IDENTITY"; then
    cat >&2 <<EOF
fork/build.sh: signing identity $BLANC_FORK_IDENTITY ("Blanc Personal Signing") not found.
Run this in your own Terminal (agent sandboxes can't see the login keychain),
or use --adhoc for a test build.
EOF
    exit 1
  fi
fi

if [ "$install_deps" = 1 ]; then
  echo "==> npm ci"
  npm ci --no-audit --no-fund
fi

# The same pre-build checks upstream runs (predist), minus the Developer ID
# signing preflight, which a personal build doesn't use.
echo "==> brand and icon checks"
npm run --silent brand:check
npm run --silent icons:windows:check

echo "==> electron-builder (identity: $BLANC_FORK_IDENTITY)"
rm -rf dist-local-personal.noindex
npx electron-builder --mac --arm64 \
  --config fork/build/electron-builder.cjs \
  --config.directories.output=dist-local-personal.noindex

app="dist-local-personal.noindex/mac-arm64/Blanc.app"
[ -d "$app" ] || { echo "fork/build.sh: $app was not produced" >&2; exit 1; }

echo "==> checks on the built app"
fork/patches/0001-local-builds.check.sh --app "$app"

# The built app shares the installed app's ID. Keep it out of Spotlight (the
# output folder ends in .noindex) and Launch Services so it can't be opened by mistake against the real profile;
# test it with fork/test-launch.sh instead.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u "$app" >/dev/null 2>&1 || true

echo
echo "Built: $app"
if [ "$adhoc" = 1 ]; then
  echo "This is an ad-hoc test build. Don't install it over your real Blanc:"
  echo "its Keychain identity differs from the personal certificate's."
  echo "Test it with: fork/test-launch.sh"
else
  echo "Install it with: fork/install.sh"
fi
