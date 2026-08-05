// test/budgetDerive.test.js
const test = require('node:test');
const assert = require('node:assert');
const { deriveBudgetsFromMonthly, DEFAULT_MONTHLY_TOKENS } = require('../src/shared/budgetDerive');

test('derives week/day/session from monthly tokens', () => {
  const b = deriveBudgetsFromMonthly(120_000_000);
  assert.deepStrictEqual(b, {
    month: { tokens: 120_000_000 },
    week: { tokens: 30_000_000 },
    day: { tokens: 4_000_000 },
    session: { tokens: 1_333_333 },
  });
});

test('never derives below 1 token', () => {
  const b = deriveBudgetsFromMonthly(2);
  assert.strictEqual(b.month.tokens, 2);
  assert.strictEqual(b.week.tokens, 1);
  assert.strictEqual(b.day.tokens, 1);
  assert.strictEqual(b.session.tokens, 1);
});

test('invalid input falls back to the default monthly budget', () => {
  const b = deriveBudgetsFromMonthly('lots');
  assert.strictEqual(b.month.tokens, DEFAULT_MONTHLY_TOKENS);
  const b2 = deriveBudgetsFromMonthly(-5);
  assert.strictEqual(b2.month.tokens, DEFAULT_MONTHLY_TOKENS);
});
