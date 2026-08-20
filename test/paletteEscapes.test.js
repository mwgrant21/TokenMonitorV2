// test/paletteEscapes.test.js
// Colours hardcoded outside the palette system look correct in exactly one
// palette and wrong in the other eighteen, which is why they survive review.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'src', 'renderer');
const FILES = ['dashboard/dashboard.css', 'index.html', 'terminal/terminal.js',
               'fleet/fleet.css', 'dashboard/dashboard.js'];
// tokens.css legitimately contains hex values - it is the palette definition.
const HEX = /#[0-9a-fA-F]{6}\b/g;
// dashboard.css's own `:root { ... }` default block and its nine `[data-palette="..."]`
// blocks (~lines 2-41) are a pre-existing, currently-live legacy palette engine (driven
// by settingsPanel.js) that predates and parallels the tokens.css layer this guard
// protects; it is tracked in docs/follow-ups.md item 6 and migrates in Task 6, not here.
const LEGACY_PALETTE_BLOCK = /:root\s*\{[^{}]*\}\s*(?:\[data-palette="[^"]+"\]\s*\{[^{}]*\}\s*)+/;

test('no hardcoded hex colours outside tokens.css', () => {
  const hits = [];
  for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    let text = fs.readFileSync(p, 'utf8');
    if (rel === 'dashboard/dashboard.css') text = text.replace(LEGACY_PALETTE_BLOCK, '');
    const found = text.match(HEX);
    if (found) hits.push(`${rel}: ${[...new Set(found)].join(', ')}`);
  }
  assert.deepStrictEqual(hits, [], `hardcoded colours found:\n${hits.join('\n')}`);
});
