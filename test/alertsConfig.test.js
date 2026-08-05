const test = require('node:test');
const assert = require('node:assert');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { loadAlertsConfig, saveAlertsConfig, sanitizeAlerts, ALERTS_DEFAULTS, RANGES } = require('../src/shared/alertsConfig');

async function tmpConfigPath() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tt-alerts-'));
  return path.join(dir, 'alerts.json');
}

test('missing file returns defaults and seeds the file', async () => {
  const p = await tmpConfigPath();
  assert.deepStrictEqual(await loadAlertsConfig(p), ALERTS_DEFAULTS);
  assert.ok(JSON.parse(await fsp.readFile(p, 'utf8')).enabled);
});

test('malformed JSON falls back without overwriting', async () => {
  const p = await tmpConfigPath();
  await fsp.writeFile(p, 'nope', 'utf8');
  assert.deepStrictEqual(await loadAlertsConfig(p), ALERTS_DEFAULTS);
  assert.strictEqual(await fsp.readFile(p, 'utf8'), 'nope');
});

test('thresholds clamp to their ranges', () => {
  const s = sanitizeAlerts({ enabled: false, thBudget: 500, thBurn: 0, thWaste: -3, thAgent: 99999 });
  assert.deepStrictEqual(s, { enabled: false, thBudget: 100, thBurn: 1, thWaste: 1, thAgent: 1000 });
});

test('non-numeric thresholds fall back to defaults', () => {
  const s = sanitizeAlerts({ thBudget: 'high', thBurn: null });
  assert.strictEqual(s.thBudget, 80);
  assert.strictEqual(s.thBurn, 2);
});

test('save merges partial and round-trips', async () => {
  const p = await tmpConfigPath();
  await saveAlertsConfig(p, { thBudget: 90 });
  const cfg = await loadAlertsConfig(p);
  assert.strictEqual(cfg.thBudget, 90);
  assert.strictEqual(cfg.thAgent, 150);
});

test('exported RANGES table matches the persisted clamp ranges', () => {
  assert.deepStrictEqual(RANGES, { thBudget: [50, 100], thBurn: [1, 10], thWaste: [1, 500], thAgent: [25, 1000] });
});
