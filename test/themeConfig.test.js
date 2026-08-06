// test/themeConfig.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  KNOWN_PALETTES, AETHER_PALETTES, LEGACY_PALETTES, KNOWN_MODES,
  DEFAULT_THEME, DEFAULT_MODE, langForPalette,
  loadThemeConfig, saveThemeConfig,
} = require('../src/shared/themeConfig');

// 14 slugs, not 19. The spec's 19 counts palette variants: five Aether slugs in two
// modes (10) plus nine single-mode legacy slugs. The mode axis supplies the doubling,
// so asserting 19 here would mean it had been baked into the slug list twice.
test('KNOWN_PALETTES has the 14 slugs and DEFAULT_THEME is one of them', () => {
  assert.equal(AETHER_PALETTES.length, 5);
  assert.equal(LEGACY_PALETTES.length, 9);
  assert.equal(KNOWN_PALETTES.length, 14);
  assert.ok(KNOWN_PALETTES.includes(DEFAULT_THEME));
  assert.equal(DEFAULT_THEME, 'steel');
  assert.equal(DEFAULT_MODE, 'dark');
  assert.deepEqual(KNOWN_MODES, ['dark', 'light']);
});

test('the slug list and the mode axis multiply out to the spec 19 variants', () => {
  assert.equal(AETHER_PALETTES.length * KNOWN_MODES.length + LEGACY_PALETTES.length, 19);
});

test('tokyonight is gone from every slug list', () => {
  assert.ok(!KNOWN_PALETTES.includes('tokyonight'));
});

test('langForPalette derives aether for Aether slugs and flat for legacy', () => {
  for (const slug of AETHER_PALETTES) assert.equal(langForPalette(slug), 'aether');
  for (const slug of LEGACY_PALETTES) assert.equal(langForPalette(slug), 'flat');
});

test('loadThemeConfig creates the file with the default if missing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');

  const loaded = await loadThemeConfig(configPath);
  assert.deepEqual(loaded, { theme: DEFAULT_THEME, mode: DEFAULT_MODE, lang: 'aether' });

  // lang is derived on read, so it must NOT appear in the file.
  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), { theme: DEFAULT_THEME, mode: DEFAULT_MODE });
});

test('saveThemeConfig / loadThemeConfig round-trip a valid theme', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');

  await saveThemeConfig(configPath, { theme: 'nord' });
  const loaded = await loadThemeConfig(configPath);
  assert.equal(loaded.theme, 'nord');
});

test('loadThemeConfig falls back to default for an unknown palette', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');
  await fs.writeFile(configPath, JSON.stringify({ theme: 'neon-dreams' }), 'utf8');

  const loaded = await loadThemeConfig(configPath);
  assert.equal(loaded.theme, DEFAULT_THEME);
});

test('loadThemeConfig falls back to default for a missing theme field', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');
  await fs.writeFile(configPath, JSON.stringify({ notTheme: 'nord' }), 'utf8');

  const loaded = await loadThemeConfig(configPath);
  assert.equal(loaded.theme, DEFAULT_THEME);
});

test('loadThemeConfig returns default and does not overwrite a malformed JSON file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');
  const malformed = '{ this is not valid json ';
  await fs.writeFile(configPath, malformed, 'utf8');

  const loaded = await loadThemeConfig(configPath);
  assert.deepEqual(loaded, { theme: DEFAULT_THEME, mode: DEFAULT_MODE, lang: 'aether' });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.equal(fileContents, malformed);
});

test('saveThemeConfig creates parent directories if they do not exist', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'nested', 'deeper', 'theme.json');

  await saveThemeConfig(configPath, { theme: 'nord', mode: 'dark' });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), { theme: 'nord', mode: 'dark' });
});

test('saveThemeConfig coerces an unknown theme to the default before writing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');

  await saveThemeConfig(configPath, { theme: 'not-a-real-theme' });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.equal(JSON.parse(fileContents).theme, DEFAULT_THEME);
});

// --- Task 5: palette, mode and language ------------------------------------
// saveThemeConfig wrote JSON.stringify({ theme }) and discarded every other key.
// A mode toggle built on that would appear to work and revert on restart, with no
// error anywhere - so the round-trip is asserted, never eyeballed.

test('save then load round-trips all three axes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-theme-'));
  const p = path.join(dir, 'theme.json');
  await saveThemeConfig(p, { theme: 'violet', mode: 'light', lang: 'aether' });
  const back = await loadThemeConfig(p);
  assert.equal(back.theme, 'violet');
  assert.equal(back.mode, 'light');   // the axis Trap 1 silently discarded
  assert.equal(back.lang, 'aether');  // derived, so it survives without being stored
});

test('a legacy palette forces flat language regardless of what was saved', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-theme-'));
  const p = path.join(dir, 'theme.json');
  await saveThemeConfig(p, { theme: 'midnight', mode: 'dark', lang: 'aether' });
  assert.equal((await loadThemeConfig(p)).lang, 'flat');
});

test('a user on the cut tokyonight palette falls back cleanly', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-theme-'));
  const p = path.join(dir, 'theme.json');
  await fs.writeFile(p, JSON.stringify({ theme: 'tokyonight' }));
  const back = await loadThemeConfig(p);
  assert.equal(back.theme, DEFAULT_THEME);
});
