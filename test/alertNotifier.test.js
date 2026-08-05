// test/alertNotifier.test.js
const test = require('node:test');
const assert = require('node:assert');
const { pickNewAlerts } = require('../src/main/alertNotifier');

const A = { id: 'a', severity: 'critical', title: 'A', detail: 'da' };
const B = { id: 'b', severity: 'warning', title: 'B', detail: 'db' };

test('first evaluation reports every alert as new', () => {
  const { newAlerts, nextIds } = pickNewAlerts(new Set(), [A, B]);
  assert.deepStrictEqual(newAlerts.map((a) => a.id), ['a', 'b']);
  assert.deepStrictEqual([...nextIds].sort(), ['a', 'b']);
});

test('already-seen alerts are not re-reported while still firing', () => {
  const { newAlerts } = pickNewAlerts(new Set(['a']), [A, B]);
  assert.deepStrictEqual(newAlerts.map((a) => a.id), ['b']);
});

test('an alert that clears is forgotten so a re-fire notifies again', () => {
  const round1 = pickNewAlerts(new Set(['a']), []); // a cleared
  assert.deepStrictEqual(round1.newAlerts, []);
  assert.strictEqual(round1.nextIds.size, 0);
  const round2 = pickNewAlerts(round1.nextIds, [A]); // a re-fires
  assert.deepStrictEqual(round2.newAlerts.map((a) => a.id), ['a']);
});

test('empty alerts with empty prev is a no-op', () => {
  const { newAlerts, nextIds } = pickNewAlerts(new Set(), []);
  assert.deepStrictEqual(newAlerts, []);
  assert.strictEqual(nextIds.size, 0);
});
