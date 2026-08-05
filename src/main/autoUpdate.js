// src/main/autoUpdate.js
const fs = require('node:fs');
const path = require('node:path');
const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function loadUpdateToken() {
  try {
    return fs.readFileSync(path.join(process.resourcesPath, 'update-token.txt'), 'utf8').trim();
  } catch {
    return null;
  }
}

function initAutoUpdate({ app, getMainWindow }) {
  if (!app.isPackaged) return;

  const token = loadUpdateToken();
  if (!token) {
    console.error('[autoUpdate] no bundled update token - skipping update checks');
    return;
  }

  autoUpdater.requestHeaders = { Authorization: `token ${token}` };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[autoUpdate] error:', err ? (err.stack || err.message) : 'unknown');
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(getMainWindow(), {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      title: 'Update Ready',
      message: `Claude Token Tracker ${info.version} has been downloaded.`,
      detail: 'Restart now to install it, or it will install automatically the next time you quit.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[autoUpdate] check failed:', err ? (err.stack || err.message) : 'unknown');
    });
  };

  check();
  setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { initAutoUpdate };
