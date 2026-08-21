const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('heroTiles.js has no inline color styles - colors come from CSS classes', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'heroTiles.js'), 'utf8');
  assert.ok(!/style="color:/.test(src), 'found an inline color style - move it to a CSS class (e.g. .hero-value.accent, .hero-sub.good)');
});
