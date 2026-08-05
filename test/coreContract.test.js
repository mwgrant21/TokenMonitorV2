// test/coreContract.test.js
// Every binding src/ imports from @tokenmonitor/core. If a future change to
// packages/core drops or renames one of these, this fails here rather than at
// runtime in the packaged app.
const test = require('node:test');
const assert = require('node:assert');
const core = require('@tokenmonitor/core');

// Exactly the ten bindings src/ destructures after Task 4. The package also
// exports PRICING_PER_MILLION_TOKENS, BAD_THRESHOLD_PER_WEEK, RULES_BY_ID,
// GUIDANCE_BY_ID, eventTimestampMs, HEADING, MANAGED_BEGIN and MANAGED_END --
// deliberately not asserted here, because the app does not consume them. Only
// the deleted modules and their deleted tests did. Asserting them would make
// this a copy of the package's own API surface rather than a statement of what
// the app depends on.
const REQUIRED = [
  'costForEvent',
  'pricingTierForModel',
  'evaluateOptimizeRules',
  'evaluateOptimizeRulesWithRecurrence',
  'summarizeOptimize',
  'gradeBreakdown',
  'appliedSummary',
  'guidanceFor',
  'isGuidanceApplied',
  'upsertGuidance',
];

test('core exports every binding the app requires', () => {
  const missing = REQUIRED.filter((name) => typeof core[name] !== 'function');
  assert.deepStrictEqual(missing, [], `missing or non-callable exports: ${missing.join(', ')}`);
});

test('core resolves to the CJS build', () => {
  // require() of an ESM-only package throws ERR_REQUIRE_ESM, so reaching this
  // line at all proves the CJS entry point resolved.
  assert.strictEqual(typeof core.costForEvent, 'function');
});
