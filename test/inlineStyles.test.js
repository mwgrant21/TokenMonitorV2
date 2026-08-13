// test/inlineStyles.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Ratchet: lower this number as Phase 5 slices land. Never raise it.
const MAX_INLINE_STYLES = 12;

test('index.html inline style budget', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  const n = (html.match(/\sstyle="/g) || []).length;
  assert.ok(n <= MAX_INLINE_STYLES,
    `${n} inline style attributes, budget is ${MAX_INLINE_STYLES}. ` +
    `Extract to dashboard.css rather than raising the budget.`);
});
