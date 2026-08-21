// src/main/versionStatus.js
// Combines the two already-tested pieces (readLatestVersion, deriveVersionStatus)
// into the one call the periodic tick and the IPC handler both need. No new
// logic: readLatestVersion already returns null for an unset/invalid folder,
// and deriveVersionStatus already maps a null latest to 'unknown' - this just
// wires them together so main.js and the test below aren't duplicating it.
const { readLatestVersion } = require('./latestVersionReader');
const { deriveVersionStatus } = require('../shared/versionCheck');

async function computeVersionStatus(currentVersion, fleetFolderPath) {
  const latest = await readLatestVersion(fleetFolderPath);
  return deriveVersionStatus(currentVersion, latest);
}

module.exports = { computeVersionStatus };
