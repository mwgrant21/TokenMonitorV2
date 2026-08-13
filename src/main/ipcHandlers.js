// src/main/ipcHandlers.js
const { ipcMain } = require('electron');
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { writeReport } = require('./reportWriter');
const { buildReportData, buildCsvReport, buildMarkdownReport, reportFileName, KNOWN_SCOPES } = require('../shared/exportReport');
const { buildTaskBreakdown } = require('../shared/taskClassifier');
const {
  evaluateOptimizeRules, evaluateOptimizeRulesWithRecurrence, summarizeOptimize,
  gradeBreakdown, appliedSummary,
  guidanceFor, isGuidanceApplied,
} = require('@tokenmonitor/core');
const { loadOptimizeState } = require('../shared/optimizeState');
const { loadBudgetConfig, saveBudgetConfig } = require('../shared/budgetConfig');
const { deriveBudgetsFromMonthly } = require('../shared/budgetDerive');
const { loadThemeConfig, saveThemeConfig, KNOWN_PALETTES, KNOWN_MODES } = require('../shared/themeConfig');
const { loadPanelsConfig, savePanelsConfig } = require('../shared/panelsConfig');
const { loadUiConfig, saveUiConfig } = require('../shared/uiConfig');
const { loadAlertsConfig, saveAlertsConfig, RANGES } = require('../shared/alertsConfig');
const { evaluateAlerts } = require('../shared/alertEngine');
const { KEYMAP } = require('../shared/shortcutMap');
const { burnSeries, spendByProject, sessionHistory, weekOverWeek, forecastMonth } = require('../shared/historyAggregator');

const PERIOD_TO_MS = {
  today: 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

async function readFileOrEmpty(p) {
  try {
    return await fsp.readFile(p, 'utf8');
  } catch {
    return '';
  }
}

// Single source of truth for dashboard state: used by the 'dashboard:getState'
// invoke handler AND by main.js's 1-second 'dashboard:update' push timer, so
// the state-building logic is never duplicated between the two call sites.
async function buildDashboardState({ liveAggregator, getHistoryEvents, getHistoryAggregator, budgetConfigPath, alertsConfigPath, optimizeStatePath, currentPeriod, getLatestCwd, getPlanUsage, getPlanWarnings, getVersionStatus }) {
  const windowMs = PERIOD_TO_MS[currentPeriod];
  const historyEvents = getHistoryEvents();
  const historyAggregator = getHistoryAggregator();
  const budgets = await loadBudgetConfig(budgetConfigPath);
  const alertsCfg = await loadAlertsConfig(alertsConfigPath);
  const totals = liveAggregator.getTotals();

  // Rules scan every event ever recorded (windowMs only sets the weekly
  // extrapolation factor), so a resolved finding would otherwise show forever.
  // evaluateOptimizeRulesWithRecurrence re-checks applied findings against
  // only the events since they were (re)applied and drops ones with no
  // recurrence, so "Apply fix" -> the card clears instead of lingering.
  const optimizeState = await loadOptimizeState(optimizeStatePath);
  const rawOptimizeFindings = evaluateOptimizeRulesWithRecurrence(historyEvents, windowMs, optimizeState);
  // A finding is "applied" once its guidance bullet exists in the global or
  // active-project CLAUDE.md managed block (written by the Apply-fix action).
  const latestCwd = typeof getLatestCwd === 'function' ? getLatestCwd() : null;
  const [globalMd, projectMd] = await Promise.all([
    readFileOrEmpty(path.join(os.homedir(), '.claude', 'CLAUDE.md')),
    latestCwd ? readFileOrEmpty(path.join(latestCwd, 'CLAUDE.md')) : Promise.resolve(''),
  ]);
  const optimizeFindings = rawOptimizeFindings.map((f) => {
    const applied = isGuidanceApplied(globalMd, f.id) || isGuidanceApplied(projectMd, f.id);
    // Any finding that reaches this point is still active evidence --
    // evaluateOptimizeRulesWithRecurrence already drops ones that were fixed
    // and never recurred. So "applied" + still-present can only mean the
    // guidance didn't stick (whether that's tracked-since-appliedAt recurrence,
    // or a bullet someone added by hand with no recorded timestamp at all).
    // Both cases get the same treatment: never a dead-end checkmark with no
    // way back to Apply.
    return { ...f, guidance: guidanceFor(f.id), applied, recurring: applied };
  });

  const windowTotals = liveAggregator.getTotals(windowMs);
  const dayTotals = historyAggregator.getTotals(PERIOD_TO_MS.today);
  const weekTotals = historyAggregator.getTotals(PERIOD_TO_MS['7d']);
  const monthTotals = historyAggregator.getTotals(PERIOD_TO_MS.month);

  const budgetVsQuota = {
    session: { used: totals.inputTokens + totals.outputTokens, limit: budgets.session.tokens },
    day: { used: dayTotals.inputTokens + dayTotals.outputTokens, limit: budgets.day.tokens },
    week: { used: weekTotals.inputTokens + weekTotals.outputTokens, limit: budgets.week.tokens },
    month: { used: monthTotals.inputTokens + monthTotals.outputTokens, limit: budgets.month.tokens },
  };
  const burnRate = liveAggregator.getBurnRate();
  const runningAgents = liveAggregator.getRunningAgents();

  const planSnapshot = typeof getPlanUsage === 'function' ? getPlanUsage() : null;

  const heroDeltas = weekOverWeek(historyEvents);
  const insights = {
    series: burnSeries(historyEvents, { period: currentPeriod }),
    projects: spendByProject(historyEvents, { sinceMs: windowMs }),
    sessions: sessionHistory(historyEvents),
    forecast: forecastMonth(historyEvents, { monthBudgetTokens: budgets.month.tokens }),
  };

  return {
    period: currentPeriod,
    versionStatus: getVersionStatus(),
    heroDeltas,
    insights,
    heroTiles: {
      burnRate,
      spend: liveAggregator.getSpend(windowMs),
      spendTokens: windowTotals.inputTokens + windowTotals.outputTokens,
      cacheHitRate: liveAggregator.getCacheHitRate(windowMs),
      oneShotRate: liveAggregator.getOneShotRate(),
    },
    budgetVsQuota,
    runningAgents,
    taskBreakdown: buildTaskBreakdown(historyEvents),
    optimizeFindings,
    optimizeSummary: summarizeOptimize(optimizeFindings),
    optimizeBreakdown: gradeBreakdown({ findings: optimizeFindings, cacheHitRate: liveAggregator.getCacheHitRate(windowMs) }),
    optimizeApplied: appliedSummary(optimizeFindings),
    alertsEnabled: alertsCfg.enabled,
    alerts: evaluateAlerts({
      config: alertsCfg,
      budgetVsQuota,
      burnNow: burnRate,
      burnBaseline: liveAggregator.getBurnRate(60 * 60 * 1000),
      optimizeFindings,
      runningAgents,
      planUsage: planSnapshot,
      planWarnings: typeof getPlanWarnings === 'function' ? getPlanWarnings() : [],
    }),
    planUsage: planSnapshot ? { ...planSnapshot, ageMinutes: Math.floor((Date.now() - planSnapshot.capturedAt) / 60000) } : null,
    planWarnings: typeof getPlanWarnings === 'function' ? getPlanWarnings() : [],
  };
}

function registerIpcHandlers({ liveAggregator, getHistoryEvents, getHistoryAggregator, budgetConfigPath, themeConfigPath, panelsConfigPath, uiConfigPath, alertsConfigPath, optimizeStatePath, getFleetFolder, getDocumentsDir, getLatestCwd, getPlanUsage, getPlanWarnings, getVersionStatus }) {
  let currentPeriod = '7d';

  ipcMain.handle('dashboard:setPeriod', (_event, period) => {
    currentPeriod = period;
    return { ok: true };
  });

  ipcMain.handle('budget:get', () => loadBudgetConfig(budgetConfigPath));
  ipcMain.handle('budget:set', async (_event, budgets) => {
    const current = await loadBudgetConfig(budgetConfigPath);
    const sanitized = {};
    for (const period of ['session', 'day', 'week', 'month']) {
      const incomingTokens = budgets && budgets[period] && budgets[period].tokens;
      const isValid = typeof incomingTokens === 'number' && Number.isFinite(incomingTokens) && incomingTokens >= 1;
      sanitized[period] = { tokens: isValid ? incomingTokens : current[period].tokens };
    }
    return saveBudgetConfig(budgetConfigPath, sanitized);
  });

  ipcMain.handle('budget:deriveFromMonthly', (_event, monthlyTokens) => deriveBudgetsFromMonthly(monthlyTokens));

  ipcMain.handle('theme:get', () => loadThemeConfig(themeConfigPath));
  ipcMain.handle('theme:set', async (_event, payload) => {
    const current = await loadThemeConfig(themeConfigPath);
    const incoming = payload && payload.theme;
    const theme = KNOWN_PALETTES.includes(incoming) ? incoming : current.theme;
    // Carry the axis this call did not specify. saveThemeConfig now persists mode as
    // well as theme, so passing { theme } alone would reset mode to the default on
    // every palette change - the same discard-what-you-do-not-name defect the plan
    // flags as Trap 1, one level up in the call chain.
    const incomingMode = payload && payload.mode;
    const mode = KNOWN_MODES.includes(incomingMode) ? incomingMode : current.mode;
    await saveThemeConfig(themeConfigPath, { theme, mode });
    // Return the resolved state so the renderer can reconcile: an invalid slug is
    // coerced here, and without the response the UI would keep showing a palette
    // that was never persisted.
    return loadThemeConfig(themeConfigPath);
  });

  ipcMain.handle('panels:get', () => loadPanelsConfig(panelsConfigPath));
  ipcMain.handle('panels:set', async (_event, payload) => {
    const current = await loadPanelsConfig(panelsConfigPath);
    const source = payload && typeof payload === 'object' ? payload : {};
    const next = {
      showOptimize: typeof source.showOptimize === 'boolean' ? source.showOptimize : current.showOptimize,
      showTreemap: typeof source.showTreemap === 'boolean' ? source.showTreemap : current.showTreemap,
      showInsights: typeof source.showInsights === 'boolean' ? source.showInsights : current.showInsights,
    };
    return savePanelsConfig(panelsConfigPath, next);
  });

  ipcMain.handle('ui:get', () => loadUiConfig(uiConfigPath));
  ipcMain.handle('ui:set', async (_event, partial) => {
    await saveUiConfig(uiConfigPath, partial);
    return loadUiConfig(uiConfigPath);
  });

  ipcMain.handle('alerts:get', () => loadAlertsConfig(alertsConfigPath));
  ipcMain.handle('alerts:set', async (_event, partial) => {
    await saveAlertsConfig(alertsConfigPath, partial);
    return loadAlertsConfig(alertsConfigPath);
  });
  ipcMain.handle('alerts:ranges', () => RANGES);

  ipcMain.handle('shortcuts:map', () => KEYMAP);

  ipcMain.handle('clipboard:write', (_event, text) => {
    require('electron').clipboard.writeText(String(text));
    return { ok: true };
  });

  ipcMain.handle('clipboard:read', () => require('electron').clipboard.readText());

  ipcMain.handle('dashboard:getState', () =>
    buildDashboardState({ liveAggregator, getHistoryEvents, getHistoryAggregator, budgetConfigPath, alertsConfigPath, optimizeStatePath, currentPeriod, getLatestCwd, getPlanUsage, getPlanWarnings, getVersionStatus })
  );

  ipcMain.handle('export:run', async (_event, payload) => {
    const format = payload && payload.format;
    const scope = payload && payload.scope;
    if (!['csv', 'md'].includes(format) || !KNOWN_SCOPES.includes(scope)) {
      return { ok: false, error: 'invalid request' };
    }
    try {
      const events = getHistoryEvents();
      const budgets = await loadBudgetConfig(budgetConfigPath);
      const findings = evaluateOptimizeRules(events, 7 * 24 * 60 * 60 * 1000);
      const username = os.userInfo().username;
      const data = buildReportData({ events, scope, username, budgets, optimizeFindings: findings });
      const content = format === 'csv' ? buildCsvReport(data) : buildMarkdownReport(data);
      const fileName = reportFileName(format, scope, new Date(), username);
      const localDir = path.join(getDocumentsDir(), 'TokenTracker');
      const result = await writeReport({ content, fileName, shareFolder: getFleetFolder(), localDir });
      return { ok: true, path: result.path, dir: result.dir, fallback: result.fallback };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  return {
    getState: () => buildDashboardState({ liveAggregator, getHistoryEvents, getHistoryAggregator, budgetConfigPath, alertsConfigPath, optimizeStatePath, currentPeriod, getLatestCwd, getPlanUsage, getPlanWarnings, getVersionStatus }),
  };
}

module.exports = { registerIpcHandlers };
