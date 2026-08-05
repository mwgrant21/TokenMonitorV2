// src/main/optimizeActionHandlers.js
const { ipcMain } = require('electron');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { guidanceFor, upsertGuidance } = require('../shared/optimizeActions');
const { recordAppliedAt } = require('../shared/optimizeState');

function globalTargetPath() {
  return path.join(os.homedir(), '.claude', 'CLAUDE.md');
}

function projectTargetPath(getLatestCwd) {
  const cwd = getLatestCwd();
  if (!cwd) return null;
  return path.join(cwd, 'CLAUDE.md');
}

async function pathExists(p) {
  try {
    await fsp.stat(p);
    return true;
  } catch {
    return false;
  }
}

function registerOptimizeActionHandlers({ getLatestCwd, optimizeStatePath }) {
  ipcMain.handle('optimize:targets', async () => {
    const globalPath = globalTargetPath();
    const projectPath = projectTargetPath(getLatestCwd);
    const global = { path: globalPath, exists: await pathExists(globalPath) };
    const project = projectPath ? { path: projectPath, exists: await pathExists(projectPath) } : null;
    return { global, project };
  });

  ipcMain.handle('optimize:apply', async (_event, { findingId, targetPath } = {}) => {
    const globalPath = globalTargetPath();
    const projectPath = projectTargetPath(getLatestCwd);

    // Server-side allowlist: the renderer can NOT inject arbitrary paths.
    const allowed = targetPath === globalPath || (projectPath !== null && targetPath === projectPath);
    if (!allowed) {
      return { ok: false, error: 'invalid target' };
    }

    // Reject unknown findings before touching the filesystem.
    if (guidanceFor(findingId) === null) {
      return { ok: false, error: 'unknown finding' };
    }

    try {
      let existing = '';
      let fileExisted = true;
      try {
        existing = await fsp.readFile(targetPath, 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') {
          existing = '';
          fileExisted = false;
        } else {
          throw err;
        }
      }

      const { content, added } = upsertGuidance(existing, findingId);
      // Recorded on every successful apply, added or not: clicking Apply-fix
      // again (a reapply) means "start the recurrence check over from now,"
      // even when the guidance bullet was already sitting in CLAUDE.md.
      if (optimizeStatePath) await recordAppliedAt(optimizeStatePath, findingId, Date.now());

      if (!added) {
        return { ok: true, added: false, alreadyPresent: true, targetPath };
      }

      let backupPath = null;
      if (fileExisted) {
        backupPath = `${targetPath}.ttbak-${Date.now()}`;
        await fsp.writeFile(backupPath, existing, 'utf8');
      }

      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.writeFile(targetPath, content, 'utf8');

      return { ok: true, added: true, targetPath, backupPath };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
}

module.exports = { registerOptimizeActionHandlers };
