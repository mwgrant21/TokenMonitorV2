// test/optimizeState.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { sanitizeState, loadOptimizeState, recordAppliedAt } = require('../src/shared/optimizeState');

async function tempStatePath() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tt-optimize-state-'));
  return path.join(dir, 'optimize-state.json');
}

test('sanitizeState keeps only finite-number entries', () => {
  assert.deepEqual(sanitizeState({ a: 123, b: 'nope', c: NaN, d: null, e: 456 }), { a: 123, e: 456 });
  assert.deepEqual(sanitizeState(null), {});
  assert.deepEqual(sanitizeState(undefined), {});
  assert.deepEqual(sanitizeState('not an object'), {});
});

test('loadOptimizeState on a missing file -> {}', async () => {
  const statePath = await tempStatePath();
  assert.deepEqual(await loadOptimizeState(statePath), {});
});

test('loadOptimizeState on invalid JSON -> {} (must not throw)', async () => {
  const statePath = await tempStatePath();
  await fsp.writeFile(statePath, 'not json{{', 'utf8');
  assert.deepEqual(await loadOptimizeState(statePath), {});
});

test('recordAppliedAt writes a fresh timestamp and loadOptimizeState reads it back', async () => {
  const statePath = await tempStatePath();
  await recordAppliedAt(statePath, 'opus-on-trivial-turns', 1000);
  assert.deepEqual(await loadOptimizeState(statePath), { 'opus-on-trivial-turns': 1000 });
});

test('recordAppliedAt merges with existing entries rather than clobbering them', async () => {
  const statePath = await tempStatePath();
  await recordAppliedAt(statePath, 'opus-on-trivial-turns', 1000);
  await recordAppliedAt(statePath, 'unpinned-config-re-reads', 2000);
  assert.deepEqual(await loadOptimizeState(statePath), {
    'opus-on-trivial-turns': 1000,
    'unpinned-config-re-reads': 2000,
  });
});

test('recordAppliedAt on the same id overwrites (reapply resets the clock)', async () => {
  const statePath = await tempStatePath();
  await recordAppliedAt(statePath, 'opus-on-trivial-turns', 1000);
  await recordAppliedAt(statePath, 'opus-on-trivial-turns', 5000);
  assert.deepEqual(await loadOptimizeState(statePath), { 'opus-on-trivial-turns': 5000 });
});
