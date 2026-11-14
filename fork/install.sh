#!/usr/bin/env bash
# fork(0001): install the personal build at /Applications/Blanc.app.
#
#   fork/install.sh [path/to/Blanc.app]   default: dist-local-personal.noindex/mac-arm64/Blanc.app
#
# Quits a running Blanc, replaces the installed app with the new one, and
# relaunches it. No old copy is kept: a second Blanc.app with the same app ID
# could be opened by mistake against the real profile. To roll back, rebuild
# an earlier commit. Your profile (~/Library/Application Support/Blanc) is not
# touched.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

src="${1:-dist-local-personal.noindex/mac-arm64/Blanc.app}"
dest=/Applications/Blanc.app
PERSONAL_IDENTITY="$(node fork/build/identity.cjs)"
[ "$PERSONAL_IDENTITY" != - ] || { echo "fork/install.sh: ad-hoc builds cannot be installed" >&2; exit 1; }

[ -d "$src" ] || { echo "fork/install.sh: $src not found; run fork/build.sh first" >&2; exit 1; }

# Refuse anything not signed with the personal certificate: an ad-hoc or
# differently signed app would lose access to the "Blanc Safe Storage" key.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
codesign --verify --deep --strict "$src"
codesign --display --extract-certificates="$tmp/cert" "$src" 2>/dev/null || true
signer="$( [ -f "$tmp/cert0" ] && openssl x509 -inform der -in "$tmp/cert0" -noout -fingerprint -sha1 | sed 's/.*=//; s/://g' || echo ad-hoc)"
if [ "$signer" != "$PERSONAL_IDENTITY" ]; then
  echo "fork/install.sh: $src is signed by $signer, not Blanc Personal Signing ($PERSONAL_IDENTITY)." >&2
  echo "Build it with fork/build.sh (not --adhoc) in your own Terminal." >&2
  exit 1
fi

if pgrep -x Blanc >/dev/null; then
  echo "==> Quitting Blanc"
  osascript -e 'tell application id "me.bnfy.bowser" to quit' || true
  for _ in $(seq 1 30); do pgrep -x Blanc >/dev/null || break; sleep 1; done
  if pgrep -x Blanc >/dev/null; then
    echo "fork/install.sh: Blanc did not quit; quit it yourself and run this again" >&2
    exit 1
  fi
fi

echo "==> Installing $dest"
rm -rf "$dest"
ditto "$src" "$dest"
codesign --verify --deep --strict "$dest"

echo "==> Launching"
open "$dest"
echo "Installed. To roll back, rebuild an earlier commit (see FORK.md → Local builds)."
