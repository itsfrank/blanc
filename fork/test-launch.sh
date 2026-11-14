#!/usr/bin/env bash
# fork(0001): launch a built Blanc with a throwaway profile and a fake
# keychain, to test a build without touching your real profile or Keychain.
#
#   fork/test-launch.sh [path/to/Blanc.app]   default: dist-local-personal.noindex/mac-arm64/Blanc.app
#
# Refuses while your installed Blanc is running: only one Blanc should run at
# a time. Agents can't run this (their sandbox blocks Chromium's startup).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

app="${1:-dist-local-personal.noindex/mac-arm64/Blanc.app}"
[ -d "$app" ] || { echo "fork/test-launch.sh: $app not found; run fork/build.sh first" >&2; exit 1; }
if pgrep -x Blanc >/dev/null; then
  echo "fork/test-launch.sh: Blanc is running. Quit it (⌘Q) first, then run this again." >&2
  exit 1
fi
profile="$(mktemp -d /tmp/blanc-test-profile.XXXXXX)"
trap 'rm -rf "$profile"' EXIT
echo "Test launch with throwaway profile $profile (deleted on quit)."
"$app/Contents/MacOS/Blanc" --user-data-dir="$profile" --use-mock-keychain
