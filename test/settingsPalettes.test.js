// test/settingsPalettes.test.js
// The renderer cannot require() shared/themeConfig - it is a classic script - so the
// palette slug list exists in two places by necessity. This test is what stops them
// drifting: it parses settingsPanel.js as text and holds it to themeConfig's list.
//
// Colours are NOT duplicated any more; they are read from tokens.css at runtime. A hex
// literal reappearing in the palette table is therefore a regression, not a style nit,
// because it can disagree with the CSS silently and look merely "a bit off".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  KNOWN_PALETTES, AETHER_PALETTES, LEGACY_PALETTES,
} = require('../src/shared/themeConfig');

const PANELS = path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels');
const settings = fs.readFileSync(path.join(PANELS, 'settingsPanel.js'), 'utf8');
const onboarding = fs.readFileSync(path.join(PANELS, 'onboarding.js'), 'utf8');
const indexHtml = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

// Pull the slugs out of the label table: { slug: 'x', label: 'X' }
function slugsFrom(source, arrayName) {
  const start = source.indexOf(`const ${arrayName} = [`);
  assert.notEqual(start, -1, `${arrayName} not found in settingsPanel.js`);
  const end = source.indexOf('];', start);
  const body = source.slice(start, end);
  return [...body.matchAll(/slug:\s*'([a-z]+)'/g)].map((m) => m[1]);
}

test('the settings palette table lists exactly themeConfig KNOWN_PALETTES', () => {
  const slugs = slugsFrom(settings, 'THEME_PALETTE_LABELS');
  assert.equal(slugs.length, 14, 'expected 14 slugs - 19 counts variants, not slugs');
  assert.deepEqual([...slugs].sort(), [...KNOWN_PALETTES].sort());
});

test('the Aether slug list in the renderer matches themeConfig', () => {
  const start = settings.indexOf('const AETHER_SLUGS = [');
  assert.notEqual(start, -1, 'AETHER_SLUGS not found');
  const body = settings.slice(start, settings.indexOf('];', start));
  const slugs = [...body.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...slugs].sort(), [...AETHER_PALETTES].sort());
  // lang derivation depends on this being exactly the Aether set.
  for (const legacy of LEGACY_PALETTES) assert.ok(!slugs.includes(legacy));
});

test('tokyonight is gone from the renderer too', () => {
  assert.ok(!settings.includes('tokyonight'), 'settingsPanel.js still names tokyonight');
  assert.ok(!onboarding.includes('tokyonight'), 'onboarding.js still names tokyonight');
});

test('palette swatch colours are not hardcoded in the renderer any more', () => {
  // They are read from tokens.css via readSwatches(). A hex here can disagree with
  // the CSS and render a swatch that misrepresents the palette it selects.
  const table = settings.slice(
    settings.indexOf('const THEME_PALETTE_LABELS = ['),
    settings.indexOf('];', settings.indexOf('const THEME_PALETTE_LABELS = [')));
  assert.equal(table.match(/#[0-9a-fA-F]{6}\b/g), null,
    'hex literals are back in the palette table');
  assert.ok(settings.includes('readSwatches'), 'readSwatches() is missing');
  assert.ok(settings.includes('--bg-base') && settings.includes('--acc'),
    'readSwatches must read --bg-base and --acc from the CSS');
});

test('the renderer switched from data-palette to data-pal/data-mode', () => {
  // tokens.css selectors are html[data-pal][data-mode]. Anything still writing
  // data-palette drives the dead v1 blocks in dashboard.css instead.
  for (const [name, source] of [['settingsPanel.js', settings],
                                ['onboarding.js', onboarding],
                                ['index.html', indexHtml]]) {
    assert.ok(!/dataset\.palette\b/.test(source),
      `${name} still writes or reads dataset.palette`);
    assert.ok(!/data-palette/.test(source),
      `${name} still references data-palette`);
  }
});

test('boot applies all three axes, not just the palette', () => {
  assert.ok(/dataset\.pal\b/.test(indexHtml), 'boot does not set data-pal');
  assert.ok(/dataset\.mode\b/.test(indexHtml), 'boot does not set data-mode');
  assert.ok(/dataset\.lang\b/.test(indexHtml), 'boot does not set data-lang');
});
