// test/tokens.test.js
// Every palette must define the full token set. A palette missing one property
// inherits it from whichever block cascaded last, which reads as "one theme has a
// wrong colour" and is near-impossible to spot by eye across 19 palettes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'styles', 'tokens.css'), 'utf8');

// The 34 properties, verbatim from docs/prototype/index.html. There is no --acc-soft.
const TOKENS = [
  'bg-base', 'page-radial', 'panel-grad', 'panel-bd', 'panel-inset',
  'chrome-bg', 'chrome-bd', 'chip-bd', 'active-bd', 'bg-term',
  'tx-primary', 'tx-body', 'tx-secondary', 'tx-muted', 'tx-dim',
  'acc', 'acc-deep', 'acc-ink', 'acc-glow', 'acc-wash',
  'success', 'warn', 'danger', 'alarm', 'alarm-glow',
  'pulse-dur', 'r-panel', 'r-tile', 'r-chip', 'f-ui', 'f-mono',
  'flat-panel', 'flat-panel2', 'flat-bd',
];

const AETHER = ['cyan', 'azure', 'violet', 'emerald', 'steel'];

// The nine surviving legacy palettes (tokyonight was cut on WCAG measurement;
// see test/contrast.test.js). Each is translated from v1's ten-variable block
// in src/renderer/dashboard/dashboard.css into the flat-language token set.
const LEGACY = ['midnight', 'slate', 'carbon', 'nord', 'onedark',
                'solarized', 'catppuccin', 'github', 'graphite'];

// The thirteen flat-language tokens every legacy palette must define,
// per task-2-brief.md Step 1's mapping table.
const LEGACY_TOKENS = [
  'bg-base', 'flat-panel', 'flat-panel2', 'flat-bd', 'bg-term',
  'tx-primary', 'tx-body', 'tx-muted', 'acc', 'acc-ink',
  'tx-secondary', 'tx-dim', 'acc-deep',
];

function blockFor(selector) {
  const i = CSS.indexOf(selector);
  assert.notStrictEqual(i, -1, `selector not found: ${selector}`);
  const open = CSS.indexOf('{', i);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

test('the 34 token names are all defined somewhere', () => {
  const missing = TOKENS.filter((t) => !CSS.includes(`--${t}:`));
  assert.deepStrictEqual(missing, [], `never defined: ${missing.join(', ')}`);
});

test('every Aether palette defines a full colour set in both modes', () => {
  // Properties each palette block must set itself rather than inherit.
  const PER_PALETTE = [
    'bg-base', 'page-radial', 'panel-grad', 'panel-bd', 'panel-inset',
    'chrome-bg', 'chrome-bd', 'chip-bd', 'active-bd', 'bg-term',
    'tx-primary', 'tx-body', 'tx-secondary', 'tx-muted', 'tx-dim',
    'acc', 'acc-deep', 'acc-ink', 'acc-glow', 'acc-wash',
  ];
  const problems = [];
  for (const pal of AETHER) {
    for (const mode of ['dark', 'light']) {
      const body = blockFor(`html[data-pal="${pal}"][data-mode="${mode}"]`);
      for (const t of PER_PALETTE) {
        if (!body.includes(`--${t}:`)) problems.push(`${pal}/${mode} missing --${t}`);
      }
    }
  }
  assert.deepStrictEqual(problems, []);
});

function token(body, name) {
  const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(body);
  return m ? m[1].trim() : null;
}

test('alarm colours are identical across palettes WITHIN each mode', () => {
  // "An alert must mean the same thing on every desk" binds across PALETTES.
  // It does not bind across modes: every light palette legitimately overrides
  // the dark defaults, because #3be0a0 on a light panel fails contrast. What
  // must never happen is cyan and steel disagreeing inside the same mode.
  for (const mode of ['dark', 'light']) {
    const signatures = AETHER.map((pal) => {
      const body = blockFor(`html[data-pal="${pal}"][data-mode="${mode}"]`);
      // 'inherit' means the block does not override, i.e. it takes :root's value.
      return ['success', 'warn', 'danger']
        .map((t) => token(body, t) ?? 'inherit').join(' | ');
    });
    const distinct = [...new Set(signatures)];
    assert.strictEqual(distinct.length, 1,
      `${mode} palettes disagree on alarm colours:\n  ` +
      AETHER.map((p, i) => `${p}: ${signatures[i]}`).join('\n  '));
  }
});

test('every legacy palette defines the thirteen flat-language tokens', () => {
  const problems = [];
  for (const pal of LEGACY) {
    const body = blockFor(`html[data-pal="${pal}"]`);
    for (const t of LEGACY_TOKENS) {
      if (!body.includes(`--${t}:`)) problems.push(`${pal} missing --${t}`);
    }
  }
  assert.deepStrictEqual(problems, []);
});
