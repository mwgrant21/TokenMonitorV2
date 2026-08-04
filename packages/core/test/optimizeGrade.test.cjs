// test/optimizeGrade.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeBreakdown, appliedSummary, BAD_THRESHOLD_PER_WEEK } = require('../dist/cjs/optimizeGrade.cjs');

test('no findings + healthy cache -> all good, fixed order', () => {
  const rows = gradeBreakdown({ findings: [], cacheHitRate: 0.85 });
  assert.deepStrictEqual(rows.map((r) => r.key), ['model-routing', 'file-pinning', 'output-caps', 'context-hygiene']);
  assert.ok(rows.every((r) => r.status === 'good'));
});

test('finding present -> warn below threshold, bad at/above it, note carries $/wk', () => {
  const rows = gradeBreakdown({
    findings: [
      { id: 'opus-on-trivial-turns', estSavingsPerWeek: BAD_THRESHOLD_PER_WEEK },
      { id: 'uncapped-bash-output', estSavingsPerWeek: 5 },
    ],
    cacheHitRate: 0.8,
  });
  assert.strictEqual(rows[0].status, 'bad');
  assert.strictEqual(rows[2].status, 'warn');
  assert.ok(rows[2].note.includes('$5'));
  assert.strictEqual(rows[1].status, 'good'); // file-pinning absent
});

test('context hygiene tiers on cacheHitRate', () => {
  assert.strictEqual(gradeBreakdown({ findings: [], cacheHitRate: 0.7 })[3].status, 'good');
  assert.strictEqual(gradeBreakdown({ findings: [], cacheHitRate: 0.5 })[3].status, 'warn');
  assert.strictEqual(gradeBreakdown({ findings: [], cacheHitRate: 0.1 })[3].status, 'bad');
  assert.strictEqual(gradeBreakdown({ findings: [], cacheHitRate: NaN })[3].status, 'warn');
});

test('gradeBreakdown tolerates missing args', () => {
  const rows = gradeBreakdown();
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(rows[3].status, 'warn');
});

test('gradeBreakdown: only the three $/wk factors are scored; context hygiene is not', () => {
  const rows = gradeBreakdown({ findings: [], cacheHitRate: 0.85 });
  assert.deepStrictEqual(rows.map((r) => r.scored), [true, true, true, false]);
});

test('appliedSummary counts and sums only applied findings', () => {
  const out = appliedSummary([
    { id: 'a', applied: true, estSavingsPerWeek: 12.5 },
    { id: 'b', applied: false, estSavingsPerWeek: 100 },
    { id: 'c', applied: true, estSavingsPerWeek: 7.5 },
    { id: 'd', applied: true }, // no savings figure
  ]);
  assert.deepStrictEqual(out, { count: 3, totalPerWeek: 20 });
});

test('appliedSummary tolerates non-array input', () => {
  assert.deepStrictEqual(appliedSummary(undefined), { count: 0, totalPerWeek: 0 });
});
