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

test('alarm colours are identical across every palette', () => {
  // An alert must mean the same thing on every desk. Only the accent changes.
  const offenders = AETHER.flatMap((pal) => ['dark', 'light'].map((mode) => {
    const body = blockFor(`html[data-pal="${pal}"][data-mode="${mode}"]`);
    return ['success', 'warn', 'danger'].some((t) => body.includes(`--${t}:`))
      ? `${pal}/${mode} overrides an alarm colour` : null;
  })).filter(Boolean);
  assert.deepStrictEqual(offenders, []);
});
