const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadPlanUsage, savePlanUsage, sanitizeSnapshot } = require('../src/shared/planUsageConfig');

async function tmpPath() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttplan-'));
  return path.join(dir, 'planUsage.json');
}

const GOOD = { tier: 'max', session: { pct: 37 }, week: { pct: 18, resetsAt: 'Thu, Jul 16, 9am' }, weekModel: { pct: 9 }, capturedAt: 1760000000000 };

test('round-trips a valid snapshot; missing file -> null', async () => {
  const p = await tmpPath();
  assert.strictEqual(await loadPlanUsage(p), null);
  await savePlanUsage(p, GOOD);
  assert.deepStrictEqual(await loadPlanUsage(p), GOOD);
});

test('corrupt file and invalid shapes -> null', async () => {
  const p = await tmpPath();
  await fsp.writeFile(p, 'not json', 'utf8');
  assert.strictEqual(await loadPlanUsage(p), null);
  assert.strictEqual(sanitizeSnapshot({ ...GOOD, week: { pct: 250, resetsAt: 'x' } }), null);
  assert.strictEqual(sanitizeSnapshot({ ...GOOD, capturedAt: 'yesterday' }), null);
  assert.strictEqual(sanitizeSnapshot(null), null);
});

test('pro snapshot with weekModel null is valid', () => {
  const pro = { tier: 'pro', session: { pct: 61 }, week: { pct: 72, resetsAt: 'Mon' }, weekModel: null, capturedAt: 1 };
  assert.deepStrictEqual(sanitizeSnapshot(pro), pro);
});

test('week.resetsAt longer than 80 chars is rejected', () => {
  const overlong = { ...GOOD, week: { pct: 18, resetsAt: 'x'.repeat(81) } };
  assert.strictEqual(sanitizeSnapshot(overlong), null);
});
