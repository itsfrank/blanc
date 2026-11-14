'use strict';
// fork(0002): go links.
//
// With Settings → Personal fork → "Go link address" set to an address with one
// %s (for example https://example.glean.com/go/%s):
//   - typing go/<name> in the Island opens that address with <name> in place
//     of %s (rewriteTypedGoLink, hooked in main.js navigateTabToAddress);
//   - a request to http(s)://go/<name> (a clicked link, window.open, a
//     redirect, any session) is sent to the same address
//     (redirectGoLinkRequest, registered below as a fork request-redirect rule,
//     which blocking-coordinator.js checks before any blocker);
//   - go/… text never goes to the search-suggestion provider
//     (isGoLinkText, hooked in search-suggestions.js isSuggestionEligible).
// Empty address: every function returns null/false and Blanc behaves exactly
// as upstream.
//
// <name> is everything after "go/" (path, query and fragment), inserted
// without percent-encoding so slashes and query strings keep their meaning
// (unlike a search engine, which encodes the whole query).
//
// No require('electron'): unit-tested directly (fork/test/).

const { isValidSearchTemplate } = require('../search-engine-template');

const PLACEHOLDER = '%s';
// Exactly the host "go": "go/" then anything without whitespace. Not go.dev,
// golang.org, gopher/…, or "go" alone.
const TYPED_RE = /^go\/(\S*)$/i;

function template(getTemplate) {
  const value = typeof getTemplate === 'function' ? getTemplate() : getTemplate;
  return typeof value === 'string' && value.trim() && isValidSearchTemplate(value) ? value.trim() : null;
}

function fill(tpl, name) {
  // A function replacement: a string one would expand $& and $1 in the name.
  return tpl.replace(PLACEHOLDER, () => name);
}

/** Typed Island text → the go-link URL, or null to leave it to upstream. */
function rewriteTypedGoLink(text, getTemplate) {
  if (typeof text !== 'string') return null;
  const match = TYPED_RE.exec(text.trim());
  if (!match) return null;
  const tpl = template(getTemplate);
  return tpl ? fill(tpl, match[1]) : null;
}

/** A navigation URL to http(s)://go/… → the go-link URL, or null. */
function redirectGoLinkRequest(url, getTemplate) {
  let parsed;
  try { parsed = new URL(String(url)); } catch { return null; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.hostname.toLowerCase() !== 'go' || parsed.port || parsed.username || parsed.password) return null;
  const tpl = template(getTemplate);
  if (!tpl) return null;
  const name = `${parsed.pathname.replace(/^\//, '')}${parsed.search}${parsed.hash}`;
  const target = fill(tpl, name);
  // Never loop: a target that is itself a go/ host is refused.
  try { if (new URL(target).hostname.toLowerCase() === 'go') return null; } catch { return null; }
  return target;
}

/** Text that is a go link, whether or not go links are on: never a suggestion query. */
function isGoLinkText(text) {
  return typeof text === 'string' && /^go\//i.test(text.trim());
}

// Registered once, when main.js first loads this module (its typed-text hook
// runs well before any page can navigate, and the rule reads the setting on
// every request, so a change in Settings applies at once).
let installed = false;
function installGoLinkRedirect(getTemplate) {
  if (installed) return;
  installed = true;
  require('./request-redirects').addRedirectRule((details) => redirectGoLinkRequest(details.url, getTemplate));
}

module.exports = { rewriteTypedGoLink, redirectGoLinkRequest, isGoLinkText, installGoLinkRedirect };
