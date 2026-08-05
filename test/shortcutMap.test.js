// test/shortcutMap.test.js
const test = require('node:test');
const assert = require('node:assert');
const { KEYMAP, resolveShortcut } = require('../src/shared/shortcutMap');

test('maps period, settings, help and escape keys', () => {
  const ctx = { typing: false, onboardingOpen: false };
  assert.strictEqual(resolveShortcut('1', ctx), 'period:today');
  assert.strictEqual(resolveShortcut('2', ctx), 'period:7d');
  assert.strictEqual(resolveShortcut('3', ctx), 'period:30d');
  assert.strictEqual(resolveShortcut('4', ctx), 'period:month');
  assert.strictEqual(resolveShortcut(',', ctx), 'settings:toggle');
  assert.strictEqual(resolveShortcut('?', ctx), 'help:toggle');
  assert.strictEqual(resolveShortcut('Escape', ctx), 'overlay:close');
});

test('unknown keys resolve to null', () => {
  assert.strictEqual(resolveShortcut('q', { typing: false, onboardingOpen: false }), null);
});

test('ignores everything while typing or during onboarding', () => {
  assert.strictEqual(resolveShortcut('1', { typing: true, onboardingOpen: false }), null);
  assert.strictEqual(resolveShortcut('1', { typing: false, onboardingOpen: true }), null);
  assert.strictEqual(resolveShortcut('Escape', { typing: false, onboardingOpen: true }), null);
});

test('ignores chords with ctrl/alt/meta so browser conventions are untouched', () => {
  const ctx = { typing: false, onboardingOpen: false, modifier: true };
  assert.strictEqual(resolveShortcut('1', ctx), null);
  assert.strictEqual(resolveShortcut(',', ctx), null);
  assert.strictEqual(resolveShortcut('Escape', ctx), null);
});

test('maps insights and export keys (phase 3)', () => {
  const ctx = { typing: false, onboardingOpen: false };
  assert.strictEqual(resolveShortcut('i', ctx), 'insights:toggle');
  assert.strictEqual(resolveShortcut('e', ctx), 'export:open');
});

test('p and t map to view switching', () => {
  assert.equal(KEYMAP.p, 'view:personal');
  assert.equal(KEYMAP.t, 'view:team');
});

test('m maps to mini mode toggle', () => {
  assert.strictEqual(KEYMAP.m, 'mini:toggle');
});
