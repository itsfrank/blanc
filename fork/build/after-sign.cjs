'use strict';
// fork(0001): afterSign for personal builds.
//
// Upstream's scripts/after-sign-verify.js requires the owner's provisioning
// profile and the Touch ID passkey entitlement; a personal build has neither.
// This hook checks what a personal build must be instead:
//   - the signature seals the whole bundle (codesign --verify --deep --strict);
//   - it is signed by the expected identity (or ad-hoc, for local test builds);
//   - the main app carries no keychain-access-groups entitlement (macOS would
//     kill it without the owner's profile);
//   - every bundle disables library validation (needed: a self-signed or
//     ad-hoc signature has no Team ID, so macOS would refuse to load the
//     app's own Electron framework), and keeps upstream's JIT and media
//     entitlements.
const { execFileSync } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const { derBooleanTrueFromLines } = require(path.join(root, 'scripts/after-sign-verify'));

const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });

function sha1(der) {
  const info = run('openssl', ['x509', '-inform', 'der', '-noout', '-fingerprint', '-sha1'], { input: der });
  return (info.match(/Fingerprint=([0-9A-F:]+)/i)?.[1] ?? '').replaceAll(':', '').toUpperCase();
}

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const fail = (message) => { throw new Error(`fork after-sign: ${appPath}: ${message}`); };
  const identity = context.packager.platformSpecificBuildOptions.identity;
  const adhoc = identity === '-';

  try {
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  } catch (error) {
    fail(`codesign verification failed: ${String(error.stderr || error.message).trim()}`);
  }

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'blanc-fork-sign-'));
  try {
    let signer = 'ad-hoc';
    if (!adhoc) {
      run('codesign', ['--display', `--extract-certificates=${path.join(tmp, 'cert')}`, appPath]);
      if (!existsSync(path.join(tmp, 'cert0'))) fail('the app has no signing certificate');
      signer = sha1(readFileSync(path.join(tmp, 'cert0')));
      if (/^[0-9A-F]{40}$/i.test(identity) && signer !== identity.toUpperCase()) {
        fail(`signed by ${signer}, expected ${identity}`);
      }
    }

    let serial = 0;
    const der = (bundlePath) => {
      const out = path.join(tmp, `ent-${serial++}.der`);
      run('codesign', ['--display', '--entitlements', out, '--der', bundlePath]);
      return existsSync(out)
        ? run('openssl', ['asn1parse', '-inform', 'DER', '-in', out]).split(/\r?\n/).filter(Boolean)
        : [];
    };
    const has = (lines, key) => lines.some((line) => line.includes(`:${key}`));
    const isTrue = (lines, key) => derBooleanTrueFromLines(lines, key);

    const appLines = der(appPath);
    for (const restricted of ['keychain-access-groups', 'com.apple.application-identifier', 'com.apple.developer.team-identifier']) {
      if (has(appLines, restricted)) fail(`the app carries ${restricted}, which needs the owner's provisioning profile`);
    }

    const helpers = path.join(appPath, 'Contents', 'Frameworks');
    const plugin = path.join(helpers, 'Blanc Helper (Plugin).app');
    const ordinary = [appPath, ...['Blanc Helper.app', 'Blanc Helper (GPU).app', 'Blanc Helper (Renderer).app'].map((h) => path.join(helpers, h))];
    for (const bundle of [...ordinary, plugin]) {
      const lines = bundle === appPath ? appLines : der(bundle);
      for (const key of ['com.apple.security.cs.allow-jit', 'com.apple.security.cs.allow-unsigned-executable-memory', 'com.apple.security.cs.disable-library-validation']) {
        if (!isTrue(lines, key)) fail(`${path.basename(bundle)} is missing ${key}`);
      }
      if (bundle === plugin) continue;
      for (const key of ['com.apple.security.device.audio-input', 'com.apple.security.device.camera']) {
        if (!isTrue(lines, key)) fail(`${path.basename(bundle)} is missing ${key}`);
      }
    }
    console.log(`fork after-sign: ok (signer ${signer}; no restricted entitlements; JIT, media and library-validation entitlements present).`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};
