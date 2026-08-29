// src/shared/buildInfo.js
// The single source of truth for "which build is this". Generated at dist time by
// scripts/dist.js, read at runtime by the main process. No Electron import, so the
// build script and the app can share it.
//
// Why this exists at all: app.getVersion() reads whatever package.json happens to be
// in the tree, which is right by accident in a packaged build and wrong in a dev run.
// It cannot tell you which commit you are looking at, and it cannot tell you that it
// does not know. A generated file can do both.
//
// Shape:
//   { "version": "2.0.0-alpha.0", "commit": "a3f9c21",
//     "builtAt": "2026-08-29T20:21:00.000Z", "channel": "alpha" }
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../../package.json');

const BUILD_INFO_FILENAME = 'buildInfo.json';

// Repo root in a dev checkout, app root inside the packaged asar. Same relative hop.
const BUILD_INFO_PATH = path.join(__dirname, '..', '..', BUILD_INFO_FILENAME);

// The documented absent state. Every field is present so callers never branch on
// shape, only on value. 'unknown' is a distinct state from any version string and
// must never be allowed to render as one -- same rule latestVersionReader.js follows,
// for the same reason: a build that guesses its own identity is worse than one that
// admits it does not know.
const UNKNOWN_BUILD_INFO = Object.freeze({
  version: 'unknown',
  commit: 'unknown',
  builtAt: null,
  channel: 'unknown',
});

// Full sha, short sha, or git output with a trailing newline -> 7 chars.
// Anything that is not hex is not a commit, and saying so beats printing it.
function normalizeCommit(value) {
  if (typeof value !== 'string') return 'unknown';
  const cleaned = value.trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(cleaned) ? cleaned.slice(0, 7) : 'unknown';
}

// Derived from the version's prerelease tag rather than hand-set, so the two can
// never disagree. Metadata only today -- nothing consumes it. Wiring it to behaviour
// is an open decision (see docs/plans/2026-08-21-release-infrastructure.md).
function channelFor(version) {
  if (typeof version !== 'string') return 'unknown';
  const tag = /-([a-z]+)/i.exec(version);
  return tag ? tag[1].toLowerCase() : 'stable';
}

// Pure builder. The commit is injected because reading it is git's job, not this
// module's; the clock is injected so the test can assert an exact timestamp.
function buildBuildInfo({ commit, builtAt = new Date(), version = pkg.version } = {}) {
  return {
    version,
    commit: normalizeCommit(commit),
    builtAt: builtAt.toISOString(),
    channel: channelFor(version),
  };
}

// Sync on purpose: the main process needs this before it answers its first
// 'app:version' IPC, and one small local read at startup is cheaper than making
// every version surface async.
//
// A file with no usable version is not a build, so it collapses whole. A file with a
// version but a missing field keeps the version and fills the gap -- discarding a
// known-good version because a sibling field rotted would be throwing away the one
// thing we came for.
function readBuildInfo(filePath = BUILD_INFO_PATH) {
  if (typeof filePath !== 'string' || filePath.length === 0) return UNKNOWN_BUILD_INFO;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const version = parsed && parsed.version;
    if (typeof version !== 'string' || version.length === 0) return UNKNOWN_BUILD_INFO;
    const builtAt = parsed.builtAt;
    return {
      version,
      commit: normalizeCommit(parsed.commit),
      builtAt:
        typeof builtAt === 'string' && Number.isFinite(Date.parse(builtAt)) ? builtAt : null,
      channel: typeof parsed.channel === 'string' && parsed.channel.length > 0
        ? parsed.channel
        : 'unknown',
    };
  } catch {
    return UNKNOWN_BUILD_INFO;
  }
}

module.exports = {
  BUILD_INFO_FILENAME,
  BUILD_INFO_PATH,
  UNKNOWN_BUILD_INFO,
  buildBuildInfo,
  readBuildInfo,
};
