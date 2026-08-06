const fsp = require('node:fs/promises');
const path = require('node:path');

// Theme state has three axes, but only two are stored.
//
//   theme - the palette slug
//   mode  - 'dark' | 'light', which only the Aether palettes vary by
//   lang  - 'aether' | 'flat', DERIVED from the palette, never stored
//
// lang is derived because storing it admits states where it disagrees with the
// palette it describes (a legacy slug marked 'aether'), and nothing downstream
// could tell which of the two was the mistake.

// The five Aether palettes, each defined for both modes in
// src/renderer/styles/tokens.css.
const AETHER_PALETTES = [
  'cyan',
  'azure',
  'violet',
  'emerald',
  'steel',
];

// The nine surviving legacy flat palettes, in display order. tokyonight was cut on
// measured WCAG failure (tx-muted 2.76:1, tx-dim 2.31:1); see test/contrast.test.js.
// A user already on it falls back to DEFAULT_THEME rather than erroring.
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

// 14 slugs, not 19. The 19 in the spec counts palette *variants*: the five Aether
// slugs exist in both modes (5 x 2 = 10) and the nine legacy slugs are single-mode,
// giving 19 blocks in tokens.css. The mode axis supplies the doubling, so it must
// not also be baked into this list.
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

// The single place the aether/flat split is decided.
function langForPalette(theme) {
  return AETHER_PALETTES.includes(theme) ? 'aether' : 'flat';
}

function resolve(theme, mode) {
  const validTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;
  const validMode = isValidMode(mode) ? mode : DEFAULT_MODE;
  return { theme: validTheme, mode: validMode, lang: langForPalette(validTheme) };
}

async function loadThemeConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Unknown/missing/malformed values fall back to the defaults in memory.
    return resolve(parsed && parsed.theme, parsed && parsed.mode);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Malformed file (bad JSON, unreadable, etc.) - fall back to the defaults in
      // memory WITHOUT overwriting the user's file, so their data isn't clobbered
      // by a bug.
      return resolve(DEFAULT_THEME, DEFAULT_MODE);
    }
    await saveThemeConfig(configPath, { theme: DEFAULT_THEME, mode: DEFAULT_MODE });
    return resolve(DEFAULT_THEME, DEFAULT_MODE);
  }
}

async function saveThemeConfig(configPath, { theme, mode }) {
  // configPath's parent directory (e.g. ~/.claude-token-tracker) may not exist
  // yet on a fresh install; create it so the first-ever save doesn't ENOENT.
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  const validated = resolve(theme, mode);
  // lang is deliberately not written - it is derived on read.
  await fsp.writeFile(
    configPath,
    JSON.stringify({ theme: validated.theme, mode: validated.mode }, null, 2),
    'utf8',
  );
}

module.exports = {
  KNOWN_PALETTES,
  AETHER_PALETTES,
  LEGACY_PALETTES,
  KNOWN_MODES,
  DEFAULT_THEME,
  DEFAULT_MODE,
  langForPalette,
  loadThemeConfig,
  saveThemeConfig,
};
