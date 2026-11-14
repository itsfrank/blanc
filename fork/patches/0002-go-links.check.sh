#!/usr/bin/env bash
# 0002 go links (and the fork settings pattern): hooks present, tests pass,
# upstream's checks still pass, and no work address is committed.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "0002: $*" >&2; exit 1; }

hook() { # file, fixed string
  grep -qF -- "$2" "$1" || fail "$1 lost its fork(0002) hook: $2"
}
hook src/main/settings.js "...require('./fork/settings').FORK_DEFAULTS, // fork(0002)"
hook src/main/settings.js "require('./fork/settings').readForkSettings(data); // fork(0002)"
hook src/main/settings.js "require('./fork/settings').sanitizeForkSettings(partial, clean); // fork(0002)"
hook src/main/main.js "require('./fork/go-links').rewriteTypedGoLink(rawText, () => settings.getSettings().goLinkTemplate); if (goLink) rawText = goLink; // fork(0002)"
hook src/main/main.js "if (!bang && require('./fork/go-links').rewriteTypedGoLink(query, () => settings.getSettings().goLinkTemplate)) return navigateTabToAddress(id, query); // fork(0002)"
hook src/main/main.js "require('./fork/go-links').installGoLinkRedirect(() => settings.getSettings().goLinkTemplate); // fork(0002)"
hook src/main/blocking-coordinator.js "require('./fork/request-redirects').redirectFor(details); if (forkRedirect) return respond({ redirectURL: forkRedirect }); } // fork(0002)"
hook src/main/search-suggestions.js "if (require('./fork/go-links').isGoLinkText(query)) return false; // fork(0002)"
hook src/renderer/pages/settings.js "window.blancForkSettings?.render(settings); // fork(0002)"
hook src/renderer/pages/settings.html '<section class="settings-group" id="group-fork"></section>'
hook src/renderer/pages/settings.html '<script src="fork-settings.js"></script>'
hook copy/i18n-scope.json '"src/renderer/pages/fork-settings.js"'
grep -q '"goLinkTemplate"' settings-schema/schema.json || fail "settings-schema/schema.json lost goLinkTemplate in internalDefaults"

# The end-to-end test exists and parses (agents can't run it from their sandbox).
node --check fork/test/desktop/0002-go-links-smoke.mjs || fail "fork/test/desktop/0002-go-links-smoke.mjs has a syntax error"
node --check fork/test/desktop/run.mjs || fail "fork/test/desktop/run.mjs has a syntax error"

# The typed-text hook must run after bangs and before address normalization.
node -e '
const s = require("fs").readFileSync("src/main/main.js", "utf8");
const fn = s.slice(s.indexOf("function navigateTabToAddress("), s.indexOf("function navigateTabToAddress(") + 4000);
const at = (needle) => fn.indexOf(needle);
const bang = at("bangResolver.resolveTyped(rawText"), go = at("rewriteTypedGoLink(rawText"), norm = at("normalizeAddressInput(rawText)");
if (!(bang >= 0 && go > bang && norm > go)) { console.error("0002: navigateTabToAddress order changed (bang < go link < normalizeAddressInput)"); process.exit(1); }
' || exit 1

# No real go-link address is in the fork's own changes (it lives only in
# Settings). Private words in general are scanned by the 0000 check (FORK.md
# rule 5). Upstream's filter lists and bang catalog legitimately name many
# companies, so only what the fork adds on top of its base tag is scanned:
# committed fork changes, plus anything staged or modified in the work tree.
base="$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' HEAD)"
leaks="$( { git diff "$base" -- . ':!fork/patches/0002-go-links.check.sh' ':!fork/patches/0002-go-links.md'; git diff --cached -- . ':!fork/patches/0002-go-links.check.sh' ':!fork/patches/0002-go-links.md'; } \
  | grep -E '^\+' | grep -iE 'glean\.com' | grep -v 'example\.glean\.com' || true)"
if [ -n "$leaks" ]; then
  echo "$leaks" >&2
  fail "a real go-link address in the fork's changes (see above); keep it in Settings only"
fi

node --test fork/test/0002-go-links.test.js test/unit/search-suggestions.test.js test/unit/blocking-coordinator.test.js \
  test/unit/settings*.test.js test/unit/sync-settings-card.test.js \
  >/tmp/blanc-fork-0002-tests.log 2>&1 || { tail -40 /tmp/blanc-fork-0002-tests.log; fail "unit tests failed (log: /tmp/blanc-fork-0002-tests.log)"; }

for check in settings:check copy:check audit-inventory:check; do
  npm run --silent "$check" >/tmp/blanc-fork-0002-$check.log 2>&1 || { cat /tmp/blanc-fork-0002-$check.log; fail "npm run $check failed"; }
done
