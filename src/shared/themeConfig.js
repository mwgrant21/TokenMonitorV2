const fsp = require('node:fs/promises');
const path = require('node:path');

// Aether palette slugs, in display order (see docs/design/2026-08-05-app-move-and-aether-reskin.md
// section 7 and docs/prototype/index.html). Each renders in both dark and light mode.
const AETHER_PALETTES = ['cyan', 'azure', 'violet', 'emerald', 'steel'];

// Legacy palette slugs, in display order (see docs/superpowers/specs/2026-07-09-theme-picker-design.md
// and src/renderer/styles/tokens.css's [data-lang="flat"] block). tokyonight was cut.
const LEGACY_PALETTES = [
  'midnight',
  'slate',
  'carbon',
  'nord',
  'onedark',
  'solarized',
  'catppuccin',
  'github',
  'graphite',
];

const KNOWN_PALETTES = [...AETHER_PALETTES, ...LEGACY_PALETTES];

const KNOWN_MODES = ['dark', 'light'];

const DEFAULT_THEME = 'steel';
const DEFAULT_MODE = 'dark';

function isValidTheme(value) {
  return typeof value === 'string' && KNOWN_PALETTES.includes(value);
}

function isValidMode(value) {
  return typeof value === 'string' && KNOWN_MODES.includes(value);
}

// lang is derived from the palette, never stored independently, so a legacy palette can never
// disagree with the aether/flat visual language it renders in.
function deriveLang(theme) {
  return AETHER_PALETTES.includes(theme) ? 'aether' : 'flat';
}

async function loadThemeConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const theme = isValidTheme(parsed && parsed.theme) ? parsed.theme : DEFAULT_THEME;
    const mode = isValidMode(parsed && parsed.mode) ? parsed.mode : DEFAULT_MODE;
    // Unknown/missing/malformed values fall back to their defaults in memory.
    return { theme, mode, lang: deriveLang(theme) };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Malformed file (bad JSON, unreadable, etc.) - fall back to the defaults in memory
      // WITHOUT overwriting the user's file, so their data isn't clobbered by a bug.
      return { theme: DEFAULT_THEME, mode: DEFAULT_MODE, lang: deriveLang(DEFAULT_THEME) };
    }
    await saveThemeConfig(configPath, { theme: DEFAULT_THEME, mode: DEFAULT_MODE });
    return { theme: DEFAULT_THEME, mode: DEFAULT_MODE, lang: deriveLang(DEFAULT_THEME) };
  }
}

async function saveThemeConfig(configPath, { theme, mode }) {
  // configPath's parent directory (e.g. ~/.claude-token-tracker) may not exist
  // yet on a fresh install; create it so the first-ever save doesn't ENOENT.
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  const validatedTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;
  const validatedMode = isValidMode(mode) ? mode : DEFAULT_MODE;
  // lang is derived on load, not persisted, so it can never be saved out of sync with theme.
  await fsp.writeFile(
    configPath,
    JSON.stringify({ theme: validatedTheme, mode: validatedMode }, null, 2),
    'utf8'
  );
}

module.exports = {
  KNOWN_PALETTES,
  AETHER_PALETTES,
  KNOWN_MODES,
  DEFAULT_THEME,
  DEFAULT_MODE,
  loadThemeConfig,
  saveThemeConfig,
};
