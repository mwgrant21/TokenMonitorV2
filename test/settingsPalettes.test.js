// test/settingsPalettes.test.js
// settingsPanel.js is a classic renderer <script> and cannot require() the
// shared themeConfig module, so it mirrors the palette slug list. A mirror that
// nothing checks is a mirror that drifts: a slug present in one and not the
// other is either a chip the user can click that the main process then rejects
// (falling silently back to the default), or a palette with no way to pick it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { KNOWN_PALETTES, AETHER_PALETTES, KNOWN_MODES } = require('../src/shared/themeConfig');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'settingsPanel.js'),
  'utf8'
);

function arrayLiteral(name) {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(SOURCE);
  assert.ok(m, `${name} not found in settingsPanel.js`);
  return m[1];
}

test('settingsPanel THEME_PALETTES slugs match themeConfig KNOWN_PALETTES, in order', () => {
  const slugs = [...arrayLiteral('THEME_PALETTES').matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(slugs, KNOWN_PALETTES);
});

test('settingsPanel AETHER_SLUGS match themeConfig AETHER_PALETTES', () => {
  const slugs = [...arrayLiteral('AETHER_SLUGS').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(slugs, AETHER_PALETTES);
});

test('settingsPanel THEME_MODES match themeConfig KNOWN_MODES, in order', () => {
  const modes = [...arrayLiteral('THEME_MODES').matchAll(/mode:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(modes, KNOWN_MODES);
});

test('settingsPanel duplicates no palette colours - tokens.css is read at runtime', () => {
  // The swatch grid used to re-declare each palette's --bg/--acc as JS literals.
  // Any hex literal creeping back in means the grid can disagree with tokens.css.
  const found = SOURCE.match(/#[0-9a-fA-F]{3,8}\b/g);
  assert.deepStrictEqual(found, null, `hardcoded colours in settingsPanel.js: ${found}`);
});
