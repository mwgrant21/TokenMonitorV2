// test/budgetAlarmUnification.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('budgets.js no longer hardcodes the 78% warn threshold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'budgets.js'), 'utf8');
  assert.ok(!/>=\s*78/.test(src), 'budgets.js still has a hardcoded 78% threshold - drive it from state.alerts instead');
});

test('miniMode.js no longer hardcodes the 78% warn threshold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'miniMode.js'), 'utf8');
  assert.ok(!/>=\s*78/.test(src), 'miniMode.js still has a hardcoded 78% threshold - drive it from state.alerts instead');
});
