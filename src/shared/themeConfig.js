const fsp = require('node:fs/promises');
const path = require('node:path');

// Palette slugs in display order (see docs/superpowers/specs/2026-07-09-theme-picker-design.md).
const KNOWN_PALETTES = [
  'midnight',
  'slate',
  'carbon',
  'nord',
  'onedark',
  'solarized',
  'tokyonight',
  'catppuccin',
  'github',
  'graphite',
];

const DEFAULT_THEME = 'midnight';

function isValidTheme(value) {
  return typeof value === 'string' && KNOWN_PALETTES.includes(value);
}

async function loadThemeConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const theme = parsed && parsed.theme;
    // Unknown/missing/malformed theme value falls back to the default in memory.
    return { theme: isValidTheme(theme) ? theme : DEFAULT_THEME };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Malformed file (bad JSON, unreadable, etc.) - fall back to the default in memory
      // WITHOUT overwriting the user's file, so their data isn't clobbered by a bug.
      return { theme: DEFAULT_THEME };
    }
    await saveThemeConfig(configPath, { theme: DEFAULT_THEME });
    return { theme: DEFAULT_THEME };
  }
}

async function saveThemeConfig(configPath, { theme }) {
  // configPath's parent directory (e.g. ~/.claude-token-tracker) may not exist
  // yet on a fresh install; create it so the first-ever save doesn't ENOENT.
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  const validated = isValidTheme(theme) ? theme : DEFAULT_THEME;
  await fsp.writeFile(configPath, JSON.stringify({ theme: validated }, null, 2), 'utf8');
}

module.exports = { KNOWN_PALETTES, DEFAULT_THEME, loadThemeConfig, saveThemeConfig };
