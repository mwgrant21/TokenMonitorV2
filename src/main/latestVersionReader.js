// src/main/latestVersionReader.js
// Reads `latest.json` from the shared fleet folder. This is the entire "update
// check" -- one local file read off a share the app already reads. No network
// request, no update server, no bundled credential.
//
// Expected shape (everything except `version` is optional):
//   { "version": "2.2.0", "notes": "adds the tach instruments", "published": "2026-08-04" }
const fsp = require('node:fs/promises');
const path = require('node:path');

const LATEST_FILENAME = 'latest.json';

// Returns the published version string, or null when it cannot be determined.
// Every failure mode collapses to null on purpose -- folder unset, share offline,
// file absent, malformed JSON, missing field. The caller renders 'unknown',
// which is a distinct state from 'current'. A failed read must never be able to
// look like "you are up to date".
async function readLatestVersion(folderPath) {
  if (typeof folderPath !== 'string' || folderPath.length === 0) return null;
  try {
    const raw = await fsp.readFile(path.join(folderPath, LATEST_FILENAME), 'utf8');
    const parsed = JSON.parse(raw);
    const version = parsed && parsed.version;
    return typeof version === 'string' && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

module.exports = { LATEST_FILENAME, readLatestVersion };
