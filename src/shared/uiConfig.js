const fsp = require('node:fs/promises');
const path = require('node:path');

const CLI_MIN = 340;
const CLI_MAX = 920;
const UI_DEFAULTS = { onboardingComplete: false, cliWidth: 560, view: 'personal', fleetFolder: null, miniBounds: null };
const KNOWN_VIEWS = ['personal', 'team'];

function clampCliWidth(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return UI_DEFAULTS.cliWidth;
  return Math.min(CLI_MAX, Math.max(CLI_MIN, Math.round(n)));
}

function sanitizeMiniBounds(b) {
  if (!b || typeof b !== 'object') return null;
  const out = {};
  for (const k of ['x', 'y', 'width', 'height']) {
    if (typeof b[k] !== 'number' || !Number.isFinite(b[k])) return null;
    out[k] = Math.round(b[k]);
  }
  return out;
}

function sanitize(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    onboardingComplete: typeof src.onboardingComplete === 'boolean' ? src.onboardingComplete : UI_DEFAULTS.onboardingComplete,
    cliWidth: clampCliWidth(src.cliWidth),
    view: KNOWN_VIEWS.includes(src.view) ? src.view : UI_DEFAULTS.view,
    fleetFolder: typeof src.fleetFolder === 'string' && src.fleetFolder.length ? src.fleetFolder : UI_DEFAULTS.fleetFolder,
    miniBounds: sanitizeMiniBounds(src.miniBounds),
  };
}

async function loadUiConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    return sanitize(JSON.parse(raw));
  } catch (err) {
    if (err.code !== 'ENOENT') return { ...UI_DEFAULTS };
    await writeFile(configPath, UI_DEFAULTS);
    return { ...UI_DEFAULTS };
  }
}

async function writeFile(configPath, cfg) {
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf8');
}

async function saveUiConfig(configPath, partial) {
  const current = await loadUiConfig(configPath);
  const merged = sanitize({ ...current, ...(partial && typeof partial === 'object' ? partial : {}) });
  await writeFile(configPath, merged);
}

module.exports = { UI_DEFAULTS, CLI_MIN, CLI_MAX, clampCliWidth, loadUiConfig, saveUiConfig };
