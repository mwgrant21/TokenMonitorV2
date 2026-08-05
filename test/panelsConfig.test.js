// test/panelsConfig.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_PANELS, loadPanelsConfig, savePanelsConfig } = require('../src/shared/panelsConfig');

test('DEFAULT_PANELS shows optimize and hides treemap and insights', () => {
  assert.deepEqual(DEFAULT_PANELS, { showOptimize: true, showTreemap: false, showInsights: false });
});

test('loadPanelsConfig creates the file with the default if missing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');

  const loaded = await loadPanelsConfig(configPath);
  assert.deepEqual(loaded, DEFAULT_PANELS);

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), DEFAULT_PANELS);
});

test('savePanelsConfig / loadPanelsConfig round-trip valid flags', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');

  await savePanelsConfig(configPath, { showOptimize: false, showTreemap: true, showInsights: true });
  const loaded = await loadPanelsConfig(configPath);
  assert.deepEqual(loaded, { showOptimize: false, showTreemap: true, showInsights: true });
});

test('loadPanelsConfig falls back to defaults for missing fields', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');
  await fs.writeFile(configPath, JSON.stringify({ showTreemap: true }), 'utf8');

  const loaded = await loadPanelsConfig(configPath);
  assert.deepEqual(loaded, { showOptimize: true, showTreemap: true, showInsights: false });
});

test('loadPanelsConfig coerces non-boolean fields to their defaults', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');
  await fs.writeFile(configPath, JSON.stringify({ showOptimize: 'yes', showTreemap: 1 }), 'utf8');

  const loaded = await loadPanelsConfig(configPath);
  assert.deepEqual(loaded, DEFAULT_PANELS);
});

test('loadPanelsConfig returns defaults and does not overwrite a malformed JSON file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');
  const malformed = '{ this is not valid json ';
  await fs.writeFile(configPath, malformed, 'utf8');

  const loaded = await loadPanelsConfig(configPath);
  assert.deepEqual(loaded, DEFAULT_PANELS);

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.equal(fileContents, malformed);
});

test('savePanelsConfig creates parent directories if they do not exist', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'nested', 'deeper', 'panels.json');

  await savePanelsConfig(configPath, { showOptimize: false, showTreemap: false, showInsights: false });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), { showOptimize: false, showTreemap: false, showInsights: false });
});

test('savePanelsConfig coerces non-boolean inputs to defaults before writing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');

  await savePanelsConfig(configPath, { showOptimize: 'nope', showTreemap: null });

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), DEFAULT_PANELS);
});

test('showInsights defaults false, coerces non-booleans, and round-trips', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'panels-test-'));
  const configPath = path.join(tmpDir, 'panels.json');

  const seeded = await loadPanelsConfig(configPath);
  assert.equal(seeded.showInsights, false);

  await savePanelsConfig(configPath, { showOptimize: true, showTreemap: false, showInsights: 'yes' });
  assert.equal((await loadPanelsConfig(configPath)).showInsights, false); // coerced to default

  await savePanelsConfig(configPath, { showOptimize: true, showTreemap: false, showInsights: true });
  assert.equal((await loadPanelsConfig(configPath)).showInsights, true);
});
