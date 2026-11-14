'use strict';
// fork(0001): electron-builder config for personal local builds.
//
// Starts from upstream's own `build` config in package.json and overrides only
// what a personal, never-distributed Mac build needs, so upstream changes to
// the build config flow through on every update without conflicts.
//
//   npx electron-builder --config fork/build/electron-builder.cjs --mac --dir
//
// Environment:
//   BLANC_FORK_IDENTITY  SHA-1 fingerprint, or "-" for ad-hoc tests.
//                        Overrides clone-local git config blanc.signingIdentity;
//                        otherwise defaults to the original personal cert.
//   BLANC_FORK_KEYCHAIN  optional keychain file holding the identity (tests).
const path = require('node:path');
const pkg = require('../../package.json');

const identity = require('./identity.cjs').selectedIdentity();

const upstream = pkg.build;
const upstreamMac = upstream.mac;

module.exports = {
  ...upstream,
  // Upstream's afterPack verifies the packaged payload and then compiles the
  // Icon Composer catalog with Xcode's actool. The wrapper keeps every
  // verification and skips only the icon compile.
  afterPack: 'fork/build/after-pack.cjs',
  // Upstream's afterSign checks the owner's provisioning profile and Developer
  // ID; a personal build has neither. The wrapper checks the personal
  // signature instead.
  afterSign: 'fork/build/after-sign.cjs',
  // Marks the packaged app as a personal build: src/main/fork/personal-build.js
  // turns the updater off when it sees this.
  extraMetadata: { ...(upstream.extraMetadata || {}), blancPersonalBuild: true },
  // No GitHub publishing metadata (app-update.yml) in the app.
  publish: null,
  mac: {
    ...upstreamMac,
    // Dark Sunrise Spectrum as the app's own icon (Finder, Dock, Launchpad,
    // Spotlight, ⌘-Tab). A flat PNG becomes icon.icns; no Assets.car.
    icon: 'src/renderer/pages/icon-sunrise-spectrum-dark.png',
    identity: identity === '-' ? '-' : identity,
    ...(process.env.BLANC_FORK_KEYCHAIN ? { keychain: process.env.BLANC_FORK_KEYCHAIN } : {}),
    notarize: false,
    provisioningProfile: undefined,
    entitlements: path.join('fork', 'build', 'entitlements.mac.plist'),
    // Upstream's helper entitlements plus disable-library-validation (see the
    // plist). scripts/sign-mac.js still gives the Plugin helper upstream's
    // build/entitlements.mac.plugin.plist.
    entitlementsInherit: path.join('fork', 'build', 'entitlements.mac.inherit.plist'),
    target: ['dir'],
  },
};
