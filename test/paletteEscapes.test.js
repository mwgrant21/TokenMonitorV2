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
// Task 6 deleted dashboard.css's legacy `:root` + nine `[data-palette="..."]` blocks
// (docs/follow-ups.md item 6), so the exclusion this guard used to carry for them is
// gone and dashboard.css is now scanned whole, as originally specified.

test('no hardcoded hex colours outside tokens.css', () => {
  const hits = [];
  for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const found = text.match(HEX);
    if (found) hits.push(`${rel}: ${[...new Set(found)].join(', ')}`);
  }
  assert.deepStrictEqual(hits, [], `hardcoded colours found:\n${hits.join('\n')}`);
});

test('dashboard.css no longer declares a second palette engine', () => {
  const text = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.css'), 'utf8');
  // A comment explains the deletion; a selector would mean the engine came back.
  assert.strictEqual(/\[data-palette=/.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), false,
    'dashboard.css declares [data-palette] rules again - two unsynced palette engines');
});
