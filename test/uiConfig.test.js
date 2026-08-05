const test = require('node:test');
const assert = require('node:assert');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { loadUiConfig, saveUiConfig, clampCliWidth, UI_DEFAULTS } = require('../src/shared/uiConfig');

async function tmpConfigPath() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tt-ui-'));
  return path.join(dir, 'ui.json');
}

test('missing file returns defaults and seeds the file', async () => {
  const p = await tmpConfigPath();
  const cfg = await loadUiConfig(p);
  assert.deepStrictEqual(cfg, UI_DEFAULTS);
  const onDisk = JSON.parse(await fsp.readFile(p, 'utf8'));
  assert.strictEqual(onDisk.cliWidth, 560);
});

test('malformed JSON falls back to defaults without overwriting the file', async () => {
  const p = await tmpConfigPath();
  await fsp.writeFile(p, '{not json', 'utf8');
  const cfg = await loadUiConfig(p);
  assert.deepStrictEqual(cfg, UI_DEFAULTS);
  assert.strictEqual(await fsp.readFile(p, 'utf8'), '{not json');
});

test('save merges a partial onto current state and round-trips', async () => {
  const p = await tmpConfigPath();
  await saveUiConfig(p, { onboardingComplete: true });
  await saveUiConfig(p, { cliWidth: 700 });
  const cfg = await loadUiConfig(p);
  assert.strictEqual(cfg.onboardingComplete, true);
  assert.strictEqual(cfg.cliWidth, 700);
  assert.strictEqual(cfg.view, 'personal');
  assert.strictEqual(cfg.fleetFolder, null);
});

test('cliWidth is clamped to 340-920 and invalid values fall back', async () => {
  assert.strictEqual(clampCliWidth(100), 340);
  assert.strictEqual(clampCliWidth(2000), 920);
  assert.strictEqual(clampCliWidth(700.4), 700);
  assert.strictEqual(clampCliWidth('x'), 560);
  assert.strictEqual(clampCliWidth(NaN), 560);
});

test('unknown view and non-string fleetFolder are sanitized', async () => {
  const p = await tmpConfigPath();
  await fsp.writeFile(p, JSON.stringify({ view: 'bogus', fleetFolder: 42, cliWidth: 50 }), 'utf8');
  const cfg = await loadUiConfig(p);
  assert.strictEqual(cfg.view, 'personal');
  assert.strictEqual(cfg.fleetFolder, null);
  assert.strictEqual(cfg.cliWidth, 340);
});

test('miniBounds defaults to null and round-trips a bounds object', async () => {
  const p = await tmpConfigPath();
  const cfg = await loadUiConfig(p);
  assert.strictEqual(cfg.miniBounds, null);

  await saveUiConfig(p, { miniBounds: { x: 100, y: 50, width: 1440, height: 860 } });
  const cfg2 = await loadUiConfig(p);
  assert.deepStrictEqual(cfg2.miniBounds, { x: 100, y: 50, width: 1440, height: 860 });
});

test('malformed miniBounds sanitizes to null', async () => {
  const p = await tmpConfigPath();
  await saveUiConfig(p, { miniBounds: { x: 1, y: 2, width: 'wide' } });
  const cfg = await loadUiConfig(p);
  assert.strictEqual(cfg.miniBounds, null);
  await saveUiConfig(p, { miniBounds: 'nope' });
  assert.strictEqual((await loadUiConfig(p)).miniBounds, null);
});

