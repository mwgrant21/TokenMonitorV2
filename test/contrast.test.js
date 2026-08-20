// test/contrast.test.js
// Tokyo Night shipped failing WCAG (tx-muted 2.76:1, tx-dim 2.31:1) and stayed
// shipped until someone measured it by hand. With 19 palettes a manual audit is
// guaranteed to rot, so this runs on every commit.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'styles', 'tokens.css'), 'utf8');

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function blockFor(selector) {
  const i = CSS.indexOf(selector);
  assert.notStrictEqual(i, -1, `selector not found: ${selector}`);
  const open = CSS.indexOf('{', i);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

function token(body, name) {
  const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(body);
  return m ? m[1].trim() : null;
}

// 4.5:1 for body text, 3:1 for secondary and status text (WCAG AA).
const FLOORS = { 'tx-primary': 4.5, 'tx-body': 4.5, 'tx-secondary': 3, 'tx-muted': 3, 'tx-dim': 3 };

const LEGACY = ['midnight', 'slate', 'carbon', 'nord', 'onedark',
                'solarized', 'catppuccin', 'github', 'graphite'];

test('every legacy palette meets its WCAG floors against its own panel', () => {
  const failures = [];
  for (const pal of LEGACY) {
    const body = blockFor(`html[data-pal="${pal}"]`);
    const bg = token(body, 'flat-panel');
    assert.ok(bg, `${pal}: no --flat-panel`);
    for (const [name, floor] of Object.entries(FLOORS)) {
      const fg = token(body, name);
      if (!fg) continue;
      const r = ratio(fg, bg);
      if (r < floor) failures.push(`${pal} --${name}: ${r.toFixed(2)}:1 < ${floor}:1`);
    }
  }
  assert.deepStrictEqual(failures, [], `WCAG failures:\n${failures.join('\n')}`);
});

test('tokyonight is not present - it was cut on measurement', () => {
  assert.ok(!CSS.includes('data-pal="tokyonight"'),
    'tokyonight fails WCAG (tx-muted 2.76:1, tx-dim 2.31:1) and must not be reintroduced');
});
