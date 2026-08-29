// scripts/bumpArgs.js
// Decides the arguments `npm run dist` hands to commit-and-tag-version.
//
// The one rule this encodes: a build cut from a prerelease stays on that prerelease
// channel unless the caller says otherwise. Without it, the default conventional bump
// reads a `feat:` commit and graduates 2.0.0-alpha.0 straight to 2.0.0 -- an alpha
// silently becoming the 2.0 release because someone cut a build. Graduating a channel
// is a decision, so it has to be typed: `npm run dist -- --release-as minor`, or
// `-- --prerelease beta`.
//
// buildInfo.js derives `channel` from the prerelease tag, so this is also what keeps
// the channel stable across builds rather than flipping to 'stable' by accident.

// Prerelease tag only: the part after '-' and before the first '.' or '+'. Build
// metadata (2.0.0+build.7) is not a prerelease and must not be read as one.
const PRERELEASE_TAG = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/;

// Either of these means the caller has already stated what the next version should be,
// and anything this module added would be arguing with them.
const SHAPING_FLAGS = ['--prerelease', '-p', '--release-as', '-r'];

function callerNamedTheVersion(userArgs) {
  return userArgs.some((arg) => SHAPING_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`)));
}

function prereleaseTag(version) {
  const match = typeof version === 'string' ? PRERELEASE_TAG.exec(version) : null;
  return match ? match[1] : null;
}

function bumpArgs(currentVersion, userArgs = []) {
  if (callerNamedTheVersion(userArgs)) return [...userArgs];
  const tag = prereleaseTag(currentVersion);
  return tag ? [...userArgs, '--prerelease', tag] : [...userArgs];
}

module.exports = { bumpArgs, prereleaseTag };
