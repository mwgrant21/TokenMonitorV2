const fsp = require('node:fs/promises');
const path = require('node:path');

const ALERTS_DEFAULTS = { enabled: true, thBudget: 80, thBurn: 2, thWaste: 15, thAgent: 150 };
// [min, max] per threshold: budget %, burn x-baseline, waste $, agent k-tokens.
const RANGES = { thBudget: [50, 100], thBurn: [1, 10], thWaste: [1, 500], thAgent: [25, 1000] };

function clampNum(value, key) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ALERTS_DEFAULTS[key];
  const [min, max] = RANGES[key];
  return Math.min(max, Math.max(min, value));
}

function sanitizeAlerts(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : ALERTS_DEFAULTS.enabled,
    thBudget: clampNum(src.thBudget, 'thBudget'),
    thBurn: clampNum(src.thBurn, 'thBurn'),
    thWaste: clampNum(src.thWaste, 'thWaste'),
    thAgent: clampNum(src.thAgent, 'thAgent'),
  };
}

async function writeFile(configPath, cfg) {
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf8');
}

async function loadAlertsConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    return sanitizeAlerts(JSON.parse(raw));
  } catch (err) {
    if (err.code !== 'ENOENT') return { ...ALERTS_DEFAULTS };
    await writeFile(configPath, ALERTS_DEFAULTS);
    return { ...ALERTS_DEFAULTS };
  }
}

async function saveAlertsConfig(configPath, partial) {
  const current = await loadAlertsConfig(configPath);
  await writeFile(configPath, sanitizeAlerts({ ...current, ...(partial && typeof partial === 'object' ? partial : {}) }));
}

module.exports = { ALERTS_DEFAULTS, RANGES, sanitizeAlerts, loadAlertsConfig, saveAlertsConfig };
