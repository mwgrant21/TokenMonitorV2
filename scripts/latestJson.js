// scripts/latestJson.js
// Builds the `latest.json` payload that src/main/latestVersionReader.js has been
// reading since 2026-08-13 with nothing on the other end writing it.
//
// Written into dist/ beside the installer rather than straight to a share: the share
// path is per-deployment and does not belong in the repo, and a file that is always
// produced is one the release runbook can point at. Copying it to the share is the
// documented last step of cutting a build (docs/RELEASE.md).

// Date only, from the build instant. The reader ignores this field entirely -- it is
// there for whoever opens the file on the share and wants to know how old it is, so it
// records when the build was cut, not when someone got round to copying it.
function publishedDate(builtAt) {
  const ms = Date.parse(builtAt);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

function buildLatestJson({ version, builtAt, notes } = {}) {
  const payload = { version };
  const published = publishedDate(builtAt);
  if (published) payload.published = published;
  // Absent rather than empty: the reader treats notes as optional, and an empty string
  // reads as "the release had nothing to say" rather than "nobody wrote notes".
  if (typeof notes === 'string' && notes.trim()) payload.notes = notes.trim();
  return payload;
}

module.exports = { buildLatestJson };
