import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOptimizeRules, summarizeOptimize, costForEvent, gradeBreakdown, upsertGuidance, eventTimestampMs } from '../dist/esm/index.js';

test('ESM entry exposes the full surface', () => {
  assert.equal(typeof evaluateOptimizeRules, 'function');
  assert.equal(typeof summarizeOptimize, 'function');
  assert.equal(typeof costForEvent, 'function');
  assert.equal(typeof gradeBreakdown, 'function');
  assert.equal(typeof upsertGuidance, 'function');
});

test('eventTimestampMs accepts a Date (Aether) and an ISO string (TokenMonitor)', () => {
  const d = new Date('2026-07-01T10:00:00Z');
  assert.equal(eventTimestampMs({ kind: 'assistant', timestamp: d }), d.getTime());
  assert.equal(eventTimestampMs({ kind: 'assistant', timestamp: '2026-07-01T10:00:00Z' }), d.getTime());
  assert.ok(Number.isNaN(eventTimestampMs(null)));
  assert.ok(Number.isNaN(eventTimestampMs({ kind: 'assistant' })));
});

test('cost-of-thrash rule is present and fires (the rule TokenMonitor gains)', () => {
  const events = [];
  for (let i = 0; i < 4; i++) {
    events.push({ kind: 'assistant', toolUses: [{ id: `t${i}`, name: 'Read', input: { file_path: 'C:\\repo\\config.ts' } }], toolResults: [] });
    events.push({ kind: 'user', toolUses: [], toolResults: [{ toolUseId: `t${i}` }] });
  }
  const found = evaluateOptimizeRules(events, 7 * 24 * 60 * 60 * 1000);
  const thrash = found.find((f) => f.id === 'cost-of-thrash');
  assert.ok(thrash, 'cost-of-thrash should fire');
  assert.match(thrash.detail, /redundant read\/write calls across config\.ts/);
});
