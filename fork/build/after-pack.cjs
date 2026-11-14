'use strict';
// fork(0001): afterPack for personal builds.
//
// Upstream's scripts/after-pack-app-icons.js first verifies the packaged
// payload (blocker lists, uBO, capture runtime, licence notices, browser role)
// and then compiles the Icon Composer catalog with Xcode's actool. This Mac has
// no Xcode, and the personal build uses a flat icon, so this hook runs the same
// verifications and skips only the icon compile.
//
// It fails closed if upstream adds, removes or renames a verification, so the
// list below can't silently fall behind upstream.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const UPSTREAM_HOOK = path.join(root, 'scripts', 'after-pack-app-icons.js');

// The calls upstream's hook makes before it reaches the icon compile.
const EXPECTED_CALLS = [
  'verifyPackagedAdblock',
  'verifyPackagedUblock',
  'verifyPackagedCaptureRuntime',
  'packageCompliance',
  'verifyPackagedCompliance',
  'verifyPackagedBrowserRole',
];

function upstreamCalls() {
  const source = fs.readFileSync(UPSTREAM_HOOK, 'utf8');
  const body = source.slice(source.indexOf('module.exports = async function'));
  return [...body.matchAll(/^\s*(?:await\s+)?(verify\w+|package\w+)\(/gm)].map((m) => m[1]);
}

function assertInSync() {
  const actual = upstreamCalls();
  if (actual.join(',') !== EXPECTED_CALLS.join(',')) {
    throw new Error([
      'fork/build/after-pack.cjs: upstream scripts/after-pack-app-icons.js changed its verifications.',
      `  expected: ${EXPECTED_CALLS.join(', ')}`,
      `  upstream: ${actual.join(', ')}`,
      'Update EXPECTED_CALLS and the calls below to match (see fork/patches/0001-local-builds.md).',
    ].join('\n'));
  }
}

async function afterPack(context) {
  assertInSync();
  const { verifyPackagedAdblock } = require(path.join(root, 'scripts/verify-packaged-adblock'));
  const { verifyPackagedUblock } = require(path.join(root, 'scripts/verify-packaged-ublock'));
  const { packageCompliance } = require(path.join(root, 'scripts/package-compliance'));
  const { verifyPackagedCompliance } = require(path.join(root, 'scripts/verify-packaged-compliance'));
  const { verifyPackagedCaptureRuntime } = require(path.join(root, 'scripts/verify-packaged-capture-runtime'));
  const { verifyPackagedBrowserRole } = require(path.join(root, 'scripts/verify-packaged-browser-role'));

  if (context.electronPlatformName !== 'darwin') {
    throw new Error('fork/build/after-pack.cjs: personal builds are macOS only');
  }
  const macAppPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const resourcesDir = path.join(macAppPath, 'Contents/Resources');
  verifyPackagedAdblock(path.join(resourcesDir, 'app.asar'));
  verifyPackagedUblock(path.join(resourcesDir, 'app.asar'));
  verifyPackagedCaptureRuntime(path.join(resourcesDir, 'app.asar'), context.electronPlatformName);
  await packageCompliance(context);
  verifyPackagedCompliance(resourcesDir);
  verifyPackagedBrowserRole(macAppPath);
  console.log('fork after-pack: upstream payload verifications passed; skipped the Icon Composer compile (flat icon).');
}

module.exports = afterPack;
module.exports.EXPECTED_CALLS = EXPECTED_CALLS;
module.exports.upstreamCalls = upstreamCalls;
