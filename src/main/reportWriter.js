// src/main/reportWriter.js
// Writes a generated report to the shared folder's reports/ subdir, falling
// back to a local directory when the share is missing or unreachable.
// No Electron imports - unit-testable with node --test.
const fsp = require('node:fs/promises');
const path = require('node:path');

async function writeReport({ content, fileName, shareFolder, localDir }) {
  if (shareFolder) {
    try {
      const dir = path.join(shareFolder, 'reports');
      await fsp.mkdir(dir, { recursive: true });
      const full = path.join(dir, fileName);
      await fsp.writeFile(full, content, 'utf8');
      return { path: full, dir, fallback: false };
    } catch (err) {
      // Unreachable share (offline UNC, permissions, parent-is-a-file) -
      // fall through to the local fallback.
    }
  }
  await fsp.mkdir(localDir, { recursive: true });
  const full = path.join(localDir, fileName);
  await fsp.writeFile(full, content, 'utf8');
  return { path: full, dir: localDir, fallback: true };
}

module.exports = { writeReport };
