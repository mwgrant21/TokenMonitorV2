// test/modelPricing.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { pricingTierForModel, costForEvent } = require('../src/shared/modelPricing');

test('classifies model names into pricing tiers', () => {
  assert.equal(pricingTierForModel('claude-opus-4-8'), 'opus');
  assert.equal(pricingTierForModel('claude-sonnet-5'), 'sonnet');
  assert.equal(pricingTierForModel('claude-haiku-4-5-20251001'), 'haiku');
  assert.equal(pricingTierForModel('claude-fable-5'), 'sonnet');
  assert.equal(pricingTierForModel(null), 'sonnet');
});

test('computes cost for an event with usage', () => {
  const event = {
    model: 'claude-sonnet-4-6',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  };
  const cost = costForEvent(event);
  assert.ok(cost > 0);
  assert.equal(Math.round(cost), 18); // 1M input @ $3 + 1M output @ $15 = $18
});

test('returns 0 cost for an event with no usage', () => {
  assert.equal(costForEvent({ model: 'claude-sonnet-4-6', usage: null }), 0);
});
