// test/ansiStrip.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { stripAnsi } = require('../src/shared/ansiStrip');

test('strips CSI color/cursor sequences', () => {
  assert.strictEqual(stripAnsi('\x1b[31mred\x1b[0m \x1b[2J\x1b[1;1Hhome'), 'red home');
});
test('strips OSC title sequences (BEL and ST terminated)', () => {
  assert.strictEqual(stripAnsi('\x1b]0;title\x07text\x1b]8;;x\x1b\\link'), 'textlink');
});
test('keeps newlines/tabs/CR, drops other C0 controls', () => {
  assert.strictEqual(stripAnsi('a\x00b\nc\td\r'), 'ab\nc\td\r');
});
test('plain text passes through', () => {
  assert.strictEqual(stripAnsi('Current week (all models) 42% used'), 'Current week (all models) 42% used');
});
