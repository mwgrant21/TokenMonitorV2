const fsp = require('node:fs/promises');
const path = require('node:path');

async function findActiveSessionFile(projectDir) {
  let entries;
  try {
    entries = await fsp.readdir(projectDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

  const jsonlFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.jsonl'));
  if (jsonlFiles.length === 0) return null;

  const withStats = await Promise.all(
    jsonlFiles.map(async (e) => {
      const fullPath = path.join(projectDir, e.name);
      const stat = await fsp.stat(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    })
  );
  withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return withStats[0].fullPath;
}

// Claude Code sessions can run from any project directory, not just the
// user's home dir - the "live" session is whichever transcript across all
// projects was written to most recently, not one tied to a fixed cwd.
async function findMostRecentSessionFile(projectsRoot) {
  let projectDirs;
  try {
    projectDirs = await fsp.readdir(projectsRoot, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

  let best = null;
  for (const dirEntry of projectDirs) {
    if (!dirEntry.isDirectory()) continue;
    const candidate = await findActiveSessionFile(path.join(projectsRoot, dirEntry.name));
    if (!candidate) continue;
    const stat = await fsp.stat(candidate);
    if (!best || stat.mtimeMs > best.mtimeMs) {
      best = { fullPath: candidate, mtimeMs: stat.mtimeMs };
    }
  }
  return best ? best.fullPath : null;
}

module.exports = { findActiveSessionFile, findMostRecentSessionFile };
