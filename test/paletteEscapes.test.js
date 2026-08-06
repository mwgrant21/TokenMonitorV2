// test/paletteEscapes.test.js
// Colours hardcoded outside the palette system look correct in exactly one palette
// and wrong in the other eighteen, which is why they survive review: whoever checks
// is almost certainly looking at the one palette where the literal happens to match.
//
// Scope is wider than the plan's five files - the whole panels/ directory is included,
// which costs nothing today (none of them carry a literal) and stops the next panel
// from quietly introducing one. Three-digit hex counts too; #000 escapes a six-digit
// pattern while being exactly the same defect.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'src', 'renderer');

// tokens.css legitimately contains hex values - it IS the palette definition - and
// fonts.css contains none. Everything else resolves through var().
const FILES = [
  'index.html',
  'dashboard/dashboard.css',
  'dashboard/dashboard.js',
  'terminal/terminal.js',
  'fleet/fleet.css',
  'fleet/fleet.js',
  ...fs.readdirSync(path.join(ROOT, 'dashboard', 'panels'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => `dashboard/panels/${f}`),
];

// The leading (?<!&) excludes HTML numeric entities: &#215; (the multiplication sign
// used for the close button) otherwise reads as the three-digit colour #215.
const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

test('no hardcoded hex colours outside tokens.css', () => {
  const hits = [];
  for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const found = fs.readFileSync(p, 'utf8').match(HEX);
    if (found) hits.push(`${rel}: ${[...new Set(found)].join(', ')}`);
  }
  assert.deepStrictEqual(hits, [], `hardcoded colours found:\n${hits.join('\n')}`);
});

test('the scan actually covers the files it claims to', () => {
  // A path typo would make this suite pass by scanning nothing, which is the same
  // green-but-vacuous failure the repo has hit before with a narrow test glob.
  const missing = FILES.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  assert.deepStrictEqual(missing, [], `scan lists files that do not exist: ${missing}`);
  assert.ok(FILES.length >= 10, `expected a real file list, got ${FILES.length}`);
});

test('dashboard.css no longer defines its own palette blocks', () => {
  // v1's :root literals sat at the same specificity as tokens.css's compatibility
  // aliases and were linked afterwards, so they won - silently pinning every palette
  // to Midnight for --bg/--panel/--tx/--dim. See docs/follow-ups.md item 5.
  const css = fs.readFileSync(path.join(ROOT, 'dashboard', 'dashboard.css'), 'utf8');
  assert.ok(!/\[data-palette=/.test(css), 'dashboard.css still defines [data-palette] blocks');
  assert.ok(!/^:root\s*\{/m.test(css), 'dashboard.css still declares a :root block');
});

test('the cut tokyonight palette is gone from the renderer entirely', () => {
  // It was removed from tokens.css on measured WCAG failure but stayed selectable
  // via dashboard.css + settingsPanel.js. See docs/follow-ups.md item 6.
  for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    assert.ok(!fs.readFileSync(p, 'utf8').includes('tokyonight'),
      `${rel} still references tokyonight`);
  }
});
