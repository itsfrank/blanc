'use strict';
// fork(0001): machine-local signing selection; no private keys in Git.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const DEFAULT_IDENTITY = '4C8D41463A1DF570CF9DADABD28CC4AD8DDE5C5D';

function resolveIdentity(envIdentity, localIdentity) {
  const identity = (envIdentity || localIdentity || DEFAULT_IDENTITY).trim().toUpperCase();
  if (identity !== '-' && !/^[0-9A-F]{40}$/.test(identity)) {
    throw new Error('Personal signing identity must be a 40-character SHA-1 fingerprint (or - for test builds).');
  }
  return identity;
}

function selectedIdentity() {
  let localIdentity = '';
  try {
    localIdentity = execFileSync('git', ['config', '--local', '--get', 'blanc.signingIdentity'], {
      cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  return resolveIdentity(process.env.BLANC_FORK_IDENTITY, localIdentity);
}

module.exports = { DEFAULT_IDENTITY, resolveIdentity, selectedIdentity };
if (require.main === module) console.log(selectedIdentity());
