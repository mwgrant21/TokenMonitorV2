const fsp = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_BUDGETS = {
  session: { tokens: 2_000_000 },
  day: { tokens: 15_000_000 },
  week: { tokens: 60_000_000 },
  month: { tokens: 200_000_000 },
};

function isValidTokens(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1;
}

async function loadBudgetConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = {};
    for (const period of ['session', 'day', 'week', 'month']) {
      const tokens = parsed && parsed[period] && parsed[period].tokens;
      validated[period] = isValidTokens(tokens)
        ? { tokens }
        : JSON.parse(JSON.stringify(DEFAULT_BUDGETS[period]));
    }
    return validated;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Malformed file (bad JSON, unreadable, etc.) - fall back to defaults in memory
      // WITHOUT overwriting the user's file, so their data isn't clobbered by a bug.
      return JSON.parse(JSON.stringify(DEFAULT_BUDGETS));
    }
    await saveBudgetConfig(configPath, DEFAULT_BUDGETS);
    return JSON.parse(JSON.stringify(DEFAULT_BUDGETS));
  }
}

async function saveBudgetConfig(configPath, budgets) {
  // configPath's parent directory (e.g. ~/.claude-token-tracker) may not exist
  // yet on a fresh install; create it so the first-ever save doesn't ENOENT.
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(budgets, null, 2), 'utf8');
}

module.exports = { DEFAULT_BUDGETS, loadBudgetConfig, saveBudgetConfig };
