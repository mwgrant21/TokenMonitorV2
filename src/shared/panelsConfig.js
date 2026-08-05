const fsp = require('node:fs/promises');
const path = require('node:path');

// Which optional dashboard panels are shown. Optimize on by default, treemap and insights off.
const DEFAULT_PANELS = { showOptimize: true, showTreemap: false, showInsights: false };

// Coerce a single field to a boolean; a missing/non-boolean value falls back to
// its default so a partial or malformed file never produces undefined flags.
function coerceField(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

async function loadPanelsConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const source = parsed && typeof parsed === 'object' ? parsed : {};
    return {
      showOptimize: coerceField(source.showOptimize, DEFAULT_PANELS.showOptimize),
      showTreemap: coerceField(source.showTreemap, DEFAULT_PANELS.showTreemap),
      showInsights: coerceField(source.showInsights, DEFAULT_PANELS.showInsights),
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Malformed file (bad JSON, unreadable, etc.) - fall back to the default in
      // memory WITHOUT overwriting the user's file, so their data isn't clobbered.
      return { ...DEFAULT_PANELS };
    }
    await savePanelsConfig(configPath, DEFAULT_PANELS);
    return { ...DEFAULT_PANELS };
  }
}

async function savePanelsConfig(configPath, panels) {
  // configPath's parent directory (e.g. ~/.claude-token-tracker) may not exist
  // yet on a fresh install; create it so the first-ever save doesn't ENOENT.
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  const source = panels && typeof panels === 'object' ? panels : {};
  const validated = {
    showOptimize: coerceField(source.showOptimize, DEFAULT_PANELS.showOptimize),
    showTreemap: coerceField(source.showTreemap, DEFAULT_PANELS.showTreemap),
    showInsights: coerceField(source.showInsights, DEFAULT_PANELS.showInsights),
  };
  await fsp.writeFile(configPath, JSON.stringify(validated, null, 2), 'utf8');
  return validated;
}

module.exports = { DEFAULT_PANELS, loadPanelsConfig, savePanelsConfig };
