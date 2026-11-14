'use strict';
// fork: every setting the personal fork adds, in one place.
//
// Upstream's src/main/settings.js calls this module from three hooks:
//   DEFAULTS     ...FORK_DEFAULTS            the default of every fork setting
//   getSettings  readForkSettings(data)      read validation (hand-edited file)
//   sanitize     sanitizeForkSettings(p, c)  write validation (Settings, sync)
// A new fork setting is one entry in FORK_SETTINGS below, plus its UI entry in
// src/renderer/pages/fork-settings.js, its strings and its schema key (see
// FORK.md → "Adding a fork setting"). It needs no new hook in upstream files.
//
// No require('electron') here: unit-tested directly (fork/test/).

const { isValidSearchTemplate } = require('../search-engine-template');

/**
 * key → { default, valid(value) }. `valid` decides both reads and writes: an
 * invalid stored value reads as the default, and an invalid write is dropped
 * so the previous value stays (the Settings page shows its error).
 */
const FORK_SETTINGS = {
  // fork(0002): go links. Empty = off. Otherwise an address with one %s
  // where the link name goes, e.g. https://example.glean.com/go/%s. Uses
  // upstream's custom-search-address rules (https, or http on the local
  // network; one lowercase %s after the host; no credentials; ≤ 2048 chars).
  goLinkTemplate: {
    default: '',
    valid: (value) => typeof value === 'string' && (value.trim() === '' || isValidSearchTemplate(value)),
    normalize: (value) => value.trim(),
  },
};

const FORK_DEFAULTS = Object.freeze(Object.fromEntries(
  Object.entries(FORK_SETTINGS).map(([key, spec]) => [key, spec.default]),
));

/** Read: replace any invalid stored fork value with its default. Mutates `data`. */
function readForkSettings(data) {
  for (const [key, spec] of Object.entries(FORK_SETTINGS)) {
    if (!spec.valid(data[key])) data[key] = spec.default;
  }
  return data;
}

/** Write: copy valid fork keys from `partial` into `clean`, dropping invalid ones. */
function sanitizeForkSettings(partial, clean) {
  if (!partial || typeof partial !== 'object') return clean;
  for (const [key, spec] of Object.entries(FORK_SETTINGS)) {
    if (!(key in partial) || !spec.valid(partial[key])) continue;
    clean[key] = spec.normalize ? spec.normalize(partial[key]) : partial[key];
  }
  return clean;
}

module.exports = { FORK_SETTINGS, FORK_DEFAULTS, readForkSettings, sanitizeForkSettings };
