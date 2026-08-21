// test/optimizeMarkup.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('optimize.js has no inline border-left-color - recurring findings use a CSS class instead', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'optimize.js'), 'utf8');
  assert.ok(!/style="border-left-color/.test(src), 'found the decorative border-left-color rotation - replace with the .recurring class, driven by the real f.recurring field');
});
