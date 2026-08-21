const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('critical and warning alert rows use different accent colors', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'dashboard.css'), 'utf8');
  const criticalRule = css.match(/\.alert-row\.critical\s*\{[^}]*\}/);
  const warningRule = css.match(/\.alert-row\.warning\s*\{[^}]*\}/);
  assert.ok(criticalRule && warningRule, 'expected both .alert-row.critical and .alert-row.warning rules to exist');
  assert.ok(criticalRule[0].includes('--danger'), '.alert-row.critical should use --danger, not --warn');
});
