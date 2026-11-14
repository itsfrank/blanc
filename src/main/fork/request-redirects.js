'use strict';
// fork: browser-wide request redirects, checked by upstream's
// src/main/blocking-coordinator.js before any blocker sees a request, in every
// session (regular, private, profiles).
//
// Only main-frame and sub-frame navigations are considered, and each rule
// must return null for anything it doesn't own. Hooked by one line in
// blocking-coordinator.js; rules are registered from the fork's own modules
// (for example installGoLinkRedirect in go-links.js).

const rules = [];

/** Add a rule: (details) => redirect URL string, or null. */
function addRedirectRule(rule) {
  if (typeof rule === 'function') rules.push(rule);
}

/** The redirect URL for a request, or null. Never throws. */
function redirectFor(details) {
  if (!rules.length || !details) return null;
  if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') return null;
  for (const rule of rules) {
    try {
      const target = rule(details);
      if (typeof target === 'string' && target && target !== details.url) return target;
    } catch { /* a broken rule never blocks or changes a request */ }
  }
  return null;
}

/** Tests only. */
function clearRedirectRules() { rules.length = 0; }

module.exports = { addRedirectRule, redirectFor, clearRedirectRules };
