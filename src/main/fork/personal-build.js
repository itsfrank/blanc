'use strict';
// fork(0001): personal builds never self-update.
//
// A personal build is signed with a self-signed certificate, so it can never
// install an official Blanc update (macOS requires the same Developer ID), and
// letting the updater run would only download and fail, or worse replace the
// patched app. Updates come from fork/update.sh and a rebuild instead.
//
// fork/build/electron-builder.cjs stamps `blancPersonalBuild: true` into the
// packaged app's package.json (extraMetadata). Unstamped runs (npm start,
// upstream's unit tests) keep upstream's behaviour.
// Hooked in src/main/updater-policy.js → resolveUpdaterPolicy().

const PERSONAL_BUILD_UPDATE_REASON =
  'This is a personal Blanc build. Update it by rebuilding from the fork (fork/update.sh).';

function isPersonalBuild(metadata = require('../../../package.json')) {
  return metadata?.blancPersonalBuild === true;
}

/** The disabled updater policy for a personal build, or null for any other build. */
function personalBuildPolicy(disabled, metadata) {
  return isPersonalBuild(metadata) ? disabled(PERSONAL_BUILD_UPDATE_REASON) : null;
}

module.exports = { PERSONAL_BUILD_UPDATE_REASON, isPersonalBuild, personalBuildPolicy };
