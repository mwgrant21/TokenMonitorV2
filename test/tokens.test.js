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

const LEGACY = ['midnight', 'slate', 'carbon', 'nord', 'onedark',
                'solarized', 'catppuccin', 'github', 'graphite'];

// The thirteen flat-language tokens each legacy palette must define, per the
// mapping table derived from the midnight/carbon worked examples.
const FLAT_LANGUAGE = [
  'bg-base', 'flat-panel', 'flat-panel2', 'flat-bd', 'bg-term',
  'tx-primary', 'tx-body', 'tx-secondary', 'tx-muted', 'tx-dim',
  'acc', 'acc-deep', 'acc-ink',
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

test('every legacy palette defines the thirteen flat-language tokens', () => {
  const problems = [];
  for (const pal of LEGACY) {
    const body = blockFor(`html[data-pal="${pal}"]`);
    for (const t of FLAT_LANGUAGE) {
      if (!body.includes(`--${t}:`)) problems.push(`${pal} missing --${t}`);
    }
  }
  assert.deepStrictEqual(problems, []);
});

const ALARMS = ['success', 'warn', 'danger'];

// The declared value of --<token> inside a CSS block body, or null if absent.
function declared(body, token) {
  const m = body.match(new RegExp(`--${token}\\s*:\\s*([^;}]+)`));
  return m ? m[1].trim() : null;
}

// What a palette block actually resolves an alarm token to: its own declaration
// if it overrides, otherwise the shared :root value it inherits.
function resolvedAlarms(body) {
  const root = blockFor(':root{');
  return ALARMS.map((t) => declared(body, t) ?? declared(root, t));
}

test('alarm colours are identical across every palette in the same mode', () => {
  // An alert must mean the same thing on every desk running the same mode. Only the
  // accent changes between palettes. The two modes legitimately differ from each other:
  // the dark set is tuned for dark backgrounds and is illegible on light ones.
  const perMode = {};
  for (const mode of ['dark', 'light']) {
    const seen = AETHER.map((pal) => ({
      pal,
      alarms: resolvedAlarms(blockFor(`html[data-pal="${pal}"][data-mode="${mode}"]`)),
    }));
    const first = seen[0].alarms;
    for (const { pal, alarms } of seen) {
      assert.deepStrictEqual(alarms, first,
        `${pal}/${mode} disagrees with ${seen[0].pal}/${mode} on the alarm colours`);
    }
    assert.ok(first.every(Boolean), `${mode} leaves an alarm colour undefined`);
    perMode[mode] = first;
  }

  // Dark mode must still inherit :root untouched -- no per-palette dark override at
  // all, not even one that happens to restate the same values. A redundant copy is a
  // second place to edit, which is how the palettes drift apart in the first place.
  const darkOverrides = AETHER.filter((pal) => {
    const body = blockFor(`html[data-pal="${pal}"][data-mode="dark"]`);
    return ALARMS.some((t) => declared(body, t) !== null);
  });
  assert.deepStrictEqual(darkOverrides, [],
    'dark mode should inherit the shared :root alarm set, not redeclare it');

  const root = blockFor(':root{');
  assert.deepStrictEqual(perMode.dark, ALARMS.map((t) => declared(root, t)),
    'dark mode should resolve to the shared :root alarm set');

  // Light mode carries its own light-tuned triple, verbatim from the prototype.
  assert.deepStrictEqual(perMode.light, ['#0f7f55', '#96660f', '#b3283a']);
  assert.notDeepStrictEqual(perMode.light, perMode.dark);
});
