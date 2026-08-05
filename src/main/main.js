// src/main/main.js
const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { spawnPty } = require('./ptyManager');
const { registerIpcHandlers } = require('./ipcHandlers');
const { registerOptimizeActionHandlers } = require('./optimizeActionHandlers');
const { pickNewAlerts } = require('./alertNotifier');
const { LiveSessionMonitor } = require('./liveSessionMonitor');
const { UsageAggregator } = require('../shared/aggregator');
const { scanAllProjects } = require('./historyScanner');
const { readFleetSnapshots } = require('./fleetSnapshotReader');
const { writeFleetSnapshot } = require('./fleetSnapshotWriter');
const { loadUiConfig, saveUiConfig } = require('../shared/uiConfig');
const { seatsChipCounts, teamWaste, deptTotals } = require('../shared/fleetAggregator');
const { createUsageScraper } = require('./usageScraper');
const { initAutoUpdate } = require('./autoUpdate');

const UI_CONFIG_PATH = path.join(os.homedir(), '.claude-token-tracker', 'ui.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 860,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

const liveAggregator = new UsageAggregator();
let historyEvents = [];
let historyAggregator = new UsageAggregator();
const usageScraper = createUsageScraper({ configPath: path.join(os.homedir(), '.claude-token-tracker', 'planUsage.json') });

// Most-recent-by-timestamp historyEvents entry that has a non-null cwd.
function getLatestCwd() {
  let latestCwd = null;
  let latestTs = -Infinity;
  for (const event of historyEvents) {
    if (!event || !event.cwd || !event.timestamp) continue;
    const ts = event.timestamp instanceof Date ? event.timestamp.getTime() : new Date(event.timestamp).getTime();
    if (Number.isFinite(ts) && ts > latestTs) {
      latestTs = ts;
      latestCwd = event.cwd;
    }
  }
  return latestCwd;
}

app.whenReady().then(async () => {
  await usageScraper.load().catch(() => {});

  const { getState } = registerIpcHandlers({
    liveAggregator,
    getHistoryEvents: () => historyEvents,
    getHistoryAggregator: () => historyAggregator,
    budgetConfigPath: path.join(os.homedir(), '.claude-token-tracker', 'budgets.json'),
    themeConfigPath: path.join(os.homedir(), '.claude-token-tracker', 'theme.json'),
    panelsConfigPath: path.join(os.homedir(), '.claude-token-tracker', 'panels.json'),
    uiConfigPath: UI_CONFIG_PATH,
    alertsConfigPath: path.join(os.homedir(), '.claude-token-tracker', 'alerts.json'),
    optimizeStatePath: path.join(os.homedir(), '.claude-token-tracker', 'optimize-state.json'),
    getFleetFolder: () => fleetFolderPath,
    getDocumentsDir: () => {
      try { return app.getPath('documents'); } catch (err) { return path.join(os.homedir(), 'Documents'); }
    },
    getLatestCwd,
    getPlanUsage: () => usageScraper.getSnapshot(),
    getPlanWarnings: () => usageScraper.getWarnings(),
  });

  const uiCfg = await loadUiConfig(UI_CONFIG_PATH);
  if (uiCfg.fleetFolder) fleetFolderPath = uiCfg.fleetFolder;

  registerOptimizeActionHandlers({
    getLatestCwd,
    optimizeStatePath: path.join(os.homedir(), '.claude-token-tracker', 'optimize-state.json'),
  });

  const win = createWindow();
  initAutoUpdate({ app, getMainWindow: () => win });

  // Mini/companion mode: sizing + always-on-top are main-process concerns.
  let isMini = false;
  ipcMain.handle('window:setMini', async (_event, on) => {
    if (on && !isMini) {
      isMini = true;
      // A maximized window reports maximized bounds and resists setSize;
      // drop to normal state first so we save/restore sane normal bounds.
      if (win.isMaximized()) win.unmaximize();
      await saveUiConfig(UI_CONFIG_PATH, { miniBounds: win.getBounds() }).catch(() => {});
      win.setAlwaysOnTop(true);
      // Size BEFORE locking resizable: on Windows setResizable(false) clamps
      // min/max to the current size, which would make setSize a no-op.
      win.setSize(340, 520);
      win.setResizable(false);
    } else if (!on && isMini) {
      isMini = false;
      win.setAlwaysOnTop(false);
      win.setResizable(true);
      const ui = await loadUiConfig(UI_CONFIG_PATH);
      if (ui.miniBounds) win.setBounds(ui.miniBounds);
      else win.setSize(1440, 860);
    }
    return { ok: true, mini: isMini };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  const monitor = new LiveSessionMonitor({ aggregator: liveAggregator });
  monitor.start();

  const rescanHistory = async () => {
    historyEvents = await scanAllProjects(path.join(os.homedir(), '.claude', 'projects'));
    const freshAggregator = new UsageAggregator();
    for (const event of historyEvents) {
      freshAggregator.ingest(event);
    }
    historyAggregator = freshAggregator;
  };
  await rescanHistory();
  setInterval(rescanHistory, 60_000);

  let notifiedAlertIds = new Set();
  setInterval(async () => {
    const state = await getState();
    win.webContents.send('dashboard:update', state);

    // Mirror newly-firing alerts to the OS while the window is unfocused.
    const { newAlerts, nextIds } = pickNewAlerts(notifiedAlertIds, state.alerts || []);
    notifiedAlertIds = nextIds;
    if (newAlerts.length > 0 && !win.isFocused() && Notification.isSupported()) {
      const top = newAlerts[0]; // engine sorts criticals first
      const n = new Notification({ title: top.title, body: top.detail });
      n.on('click', () => { win.show(); win.focus(); });
      n.show();
    }
  }, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let activePty = null;

ipcMain.handle('pty:start', (event, { cwd, cols, rows }) => {
  // kill any prior pty so a renderer reload doesn't orphan its shell/claude session
  if (activePty) {
    activePty.kill();
    activePty = null;
  }
  activePty = spawnPty({ cwd, cols, rows });
  activePty.onData((data) => {
    usageScraper.ingest(data);
    event.sender.send('pty:data', data);
  });
  return { started: true, cwd: cwd || os.homedir() };
});

ipcMain.handle('plan:sync', async () => {
  if (!activePty) return { ok: false, error: 'no terminal' };
  const before = (usageScraper.getSnapshot() || { capturedAt: 0 }).capturedAt;
  activePty.write('/usage\r');
  // /usage repaints an unsettled "scanning" frame (no model meter) before the
  // settled one, and each buffer-cleared parse stands alone - so a fresh
  // parse alone is not enough signal to Esc. Wait for quiescence: capturedAt
  // must stop advancing for >= 2000ms before we consider the pane settled.
  const deadline = Date.now() + 10000;
  let sawFreshParse = false;
  let lastCapturedAt = before;
  let lastChangeAt = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    const snap = usageScraper.getSnapshot();
    const capturedAt = snap ? snap.capturedAt : 0;
    if (capturedAt > before) {
      sawFreshParse = true;
      if (capturedAt !== lastCapturedAt) {
        lastCapturedAt = capturedAt;
        lastChangeAt = Date.now();
      } else if (Date.now() - lastChangeAt >= 2000) {
        activePty.write('\x1b');
        return { ok: true };
      }
    }
  }
  if (sawFreshParse) {
    // Deadline hit before quiescence, but we do have data - don't leave the
    // pane open.
    activePty.write('\x1b');
    return { ok: true };
  }
  return { ok: false, error: 'could not read /usage' };
});

ipcMain.on('pty:write', (event, input) => {
  if (activePty) activePty.write(input);
});

ipcMain.on('pty:resize', (event, { cols, rows }) => {
  if (activePty) activePty.resize(cols, rows);
});

let fleetFolderPath = null;

ipcMain.handle('fleet:pickFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('fleet:connect', async (_event, folderPath) => {
  fleetFolderPath = folderPath;
  await saveUiConfig(UI_CONFIG_PATH, { fleetFolder: folderPath }).catch(() => {});
  return { ok: true };
});

ipcMain.handle('fleet:getState', async () => {
  if (!fleetFolderPath) return { connected: false, seats: [], folder: null };
  try {
    const raw = await readFleetSnapshots(fleetFolderPath);
    if (!raw.connected) return { connected: false, seats: [], folder: fleetFolderPath };
    return {
      connected: true,
      folder: fleetFolderPath,
      seats: raw.seats.map((s) => ({ ...s, runningAgents: Number(s.runningAgents) || 0 })),
      chip: seatsChipCounts(raw.seats),
      waste: teamWaste(raw.seats),
      totals: deptTotals(raw.seats),
    };
  } catch {
    return { connected: false, seats: [], error: true, folder: fleetFolderPath };
  }
});

// Write this seat's own snapshot every 5 minutes and on quit, once a folder is chosen.
setInterval(() => {
  if (fleetFolderPath) {
    writeFleetSnapshot({ folderPath: fleetFolderPath, username: os.userInfo().username, liveAggregator, historyAggregator, historyEvents }).catch(() => {});
  }
}, 5 * 60 * 1000);

app.on('before-quit', () => {
  if (fleetFolderPath) {
    writeFleetSnapshot({ folderPath: fleetFolderPath, username: os.userInfo().username, liveAggregator, historyAggregator, historyEvents }).catch(() => {});
  }
});
