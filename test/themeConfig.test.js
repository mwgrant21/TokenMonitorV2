// test/themeConfig.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { KNOWN_PALETTES, DEFAULT_THEME, loadThemeConfig, saveThemeConfig } = require('../src/shared/themeConfig');

test('KNOWN_PALETTES has the 10 slugs and DEFAULT_THEME is one of them', () => {
  assert.equal(KNOWN_PALETTES.length, 10);
  assert.ok(KNOWN_PALETTES.includes(DEFAULT_THEME));
  assert.equal(DEFAULT_THEME, 'midnight');
});

test('loadThemeConfig creates the file with the default if missing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');

  const loaded = await loadThemeConfig(configPath);
  assert.deepEqual(loaded, { theme: DEFAULT_THEME });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), { theme: DEFAULT_THEME });
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
  assert.deepEqual(loaded, { theme: DEFAULT_THEME });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.equal(fileContents, malformed);
});

test('saveThemeConfig creates parent directories if they do not exist', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'nested', 'deeper', 'theme.json');

  await saveThemeConfig(configPath, { theme: 'tokyonight' });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), { theme: 'tokyonight' });
});

test('saveThemeConfig coerces an unknown theme to the default before writing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-test-'));
  const configPath = path.join(tmpDir, 'theme.json');

  await saveThemeConfig(configPath, { theme: 'not-a-real-theme' });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), { theme: DEFAULT_THEME });
});
