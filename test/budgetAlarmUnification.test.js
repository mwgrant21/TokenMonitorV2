// test/budgetAlarmUnification.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('budgets.js no longer hardcodes the 78% warn threshold in the budget-vs-quota row loop', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'budgets.js'), 'utf8');
  // Scoped to the render() row loop's own hardcode (originally `const warn = pct >= 78;`
  // using the `pct` variable) - NOT a whole-file regex. planBar's separate, pre-existing
  // `const warn = p >= 78;` (using `p`) is a different bar with its own tier that this
  // task intentionally leaves untouched (state.alerts's plan-week entry covers it via
  // the alert banner, not this bar directly) - it must keep passing this test.
  assert.ok(!/pct\s*>=\s*78/.test(src), 'budgets.js\'s row loop still hardcodes a 78% threshold - drive it from state.alerts instead');
  assert.ok(/tierFor\(state, period\)/.test(src), 'budgets.js\'s row loop should call tierFor(state, period) instead');
  assert.ok(/const warn = p >= 78;/.test(src), 'planBar\'s own pre-existing amber check should be untouched by this task');
});

test('miniMode.js no longer hardcodes the 78% warn threshold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'miniMode.js'), 'utf8');
  assert.ok(!/>=\s*78/.test(src), 'miniMode.js still has a hardcoded 78% threshold - drive it from state.alerts instead');
});
