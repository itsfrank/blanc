'use strict';
// fork(0001): personal builds never self-update; other builds are unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const { DEFAULT_IDENTITY, resolveIdentity } = require('../build/identity.cjs');

test('signing identity uses environment, then clone-local setting, then original default', () => {
  const local = 'a'.repeat(40);
  const env = 'b'.repeat(40);
  assert.equal(resolveIdentity('', ''), DEFAULT_IDENTITY);
  assert.equal(resolveIdentity('', local), local.toUpperCase());
  assert.equal(resolveIdentity(env, local), env.toUpperCase());
  assert.equal(resolveIdentity('-', local), '-');
  for (const invalid of ['Blanc Personal Signing', 'abc', 'g'.repeat(40)]) {
    assert.throws(() => resolveIdentity(invalid, ''), /SHA-1/);
  }
});

test('build and installer share signing selection and installer rejects ad-hoc', () => {
  const fs = require('node:fs');
  for (const script of ['build.sh', 'install.sh']) {
    assert.match(fs.readFileSync(path.join(root, 'fork', script), 'utf8'), /node fork\/build\/identity\.cjs/);
  }
  const installer = fs.readFileSync(path.join(root, 'fork/install.sh'), 'utf8');
  assert.match(installer, /ad-hoc builds cannot be installed/);
  assert.doesNotMatch(installer, /BLANC_FORK_INSTALL_ANY_SIGNER/);
});

const { resolveUpdaterPolicy } = require(path.join(root, 'src/main/updater-policy'));
const personal = require(path.join(root, 'src/main/fork/personal-build'));

test('an unstamped package.json is not a personal build', () => {
  assert.equal(personal.isPersonalBuild({}), false);
  assert.equal(personal.isPersonalBuild({ blancPersonalBuild: 'yes' }), false);
  assert.equal(personal.isPersonalBuild({ blancPersonalBuild: true }), true);
  // The working tree's package.json is never stamped; only the packaged copy is.
  assert.equal(personal.isPersonalBuild(), false);
});

test('a personal build turns the updater off for every packaged launch', () => {
  const disabled = (reason) => ({ enabled: false, mode: 'disabled', reason });
  const policy = personal.personalBuildPolicy(disabled, { blancPersonalBuild: true });
  assert.equal(policy.enabled, false);
  assert.equal(policy.reason, personal.PERSONAL_BUILD_UPDATE_REASON);
  assert.equal(personal.personalBuildPolicy(disabled, {}), null);
});

test('resolveUpdaterPolicy keeps upstream behaviour in unstamped runs', () => {
  assert.equal(resolveUpdaterPolicy({ isPackaged: false }).enabled, false);
  assert.equal(resolveUpdaterPolicy({ isPackaged: true, env: {} }).mode, 'production');
});

test('resolveUpdaterPolicy disables updates in a stamped (packaged personal) build', () => {
  const id = require.resolve(path.join(root, 'package.json'));
  const original = require.cache[id];
  require.cache[id] = { id, filename: id, loaded: true, exports: { ...require(id), blancPersonalBuild: true } };
  try {
    for (const env of [{}, { BLANC_UPDATE_CHANNEL: 'staging', BLANC_UPDATE_STAGING_URL: 'https://example.test/' }]) {
      const policy = resolveUpdaterPolicy({ isPackaged: true, env });
      assert.equal(policy.enabled, false);
      assert.equal(policy.reason, personal.PERSONAL_BUILD_UPDATE_REASON);
    }
  } finally {
    if (original) require.cache[id] = original; else delete require.cache[id];
  }
});

test('the fork build config overrides only the personal settings', () => {
  const config = require(path.join(root, 'fork/build/electron-builder.cjs'));
  const upstream = require(path.join(root, 'package.json')).build;
  assert.equal(config.appId, upstream.appId);
  assert.equal(config.productName, upstream.productName);
  assert.equal(config.mac.notarize, false);
  assert.equal(config.mac.provisioningProfile, undefined);
  assert.equal(config.publish, null);
  assert.equal(config.extraMetadata.blancPersonalBuild, true);
  assert.equal(config.beforePack, upstream.beforePack);
  assert.deepEqual(config.files, upstream.files);
  assert.deepEqual(config.protocols, upstream.protocols);
  assert.deepEqual(config.electronFuses, upstream.electronFuses);
  assert.deepEqual(config.mac.extendInfo, upstream.mac.extendInfo);
});
