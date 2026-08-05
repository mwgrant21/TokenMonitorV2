// test/alertEngine.test.js
const test = require('node:test');
const assert = require('node:assert');
const { evaluateAlerts, BASELINE_FLOOR_TPM } = require('../src/shared/alertEngine');

const CONFIG = { enabled: true, thBudget: 80, thBurn: 2, thWaste: 15, thAgent: 150 };
const QUIET = {
  config: CONFIG,
  budgetVsQuota: {
    session: { used: 0, limit: 1_000_000 },
    day: { used: 0, limit: 4_000_000 },
    week: { used: 0, limit: 30_000_000 },
    month: { used: 0, limit: 120_000_000 },
  },
  burnNow: 0,
  burnBaseline: 0,
  optimizeFindings: [],
  runningAgents: [],
};

test('quiet inputs produce no alerts', () => {
  assert.deepStrictEqual(evaluateAlerts(QUIET), []);
});

test('disabled config silences everything even when triggers would fire', () => {
  const inputs = {
    ...QUIET,
    config: { ...CONFIG, enabled: false },
    budgetVsQuota: { ...QUIET.budgetVsQuota, week: { used: 29_000_000, limit: 30_000_000 } },
  };
  assert.deepStrictEqual(evaluateAlerts(inputs), []);
});

test('budget proximity fires at threshold as warning with design copy', () => {
  const inputs = { ...QUIET, budgetVsQuota: { ...QUIET.budgetVsQuota, week: { used: 24_600_000, limit: 30_000_000 } } };
  const alerts = evaluateAlerts(inputs);
  assert.strictEqual(alerts.length, 1);
  const a = alerts[0];
  assert.strictEqual(a.id, 'budget-week');
  assert.strictEqual(a.severity, 'warning');
  assert.strictEqual(a.title, 'Week budget at 82%');
  assert.strictEqual(a.detail, '24.6M of 30.0M tokens used');
  assert.strictEqual(a.chips[0].kind, 'copy');
  assert.strictEqual(a.chips[0].text, '/compact');
});

test('budget over 100% escalates to critical', () => {
  const inputs = { ...QUIET, budgetVsQuota: { ...QUIET.budgetVsQuota, session: { used: 1_100_000, limit: 1_000_000 } } };
  const alerts = evaluateAlerts(inputs);
  assert.strictEqual(alerts[0].id, 'budget-session');
  assert.strictEqual(alerts[0].severity, 'critical');
});

test('zero-limit budget windows never fire', () => {
  const inputs = { ...QUIET, budgetVsQuota: { ...QUIET.budgetVsQuota, day: { used: 5, limit: 0 } } };
  assert.deepStrictEqual(evaluateAlerts(inputs), []);
});

test('burn spike fires only above the baseline floor', () => {
  const below = { ...QUIET, burnNow: 200, burnBaseline: BASELINE_FLOOR_TPM - 1 };
  assert.deepStrictEqual(evaluateAlerts(below), []);
  const at = { ...QUIET, burnNow: 230, burnBaseline: 100 };
  const alerts = evaluateAlerts(at);
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].id, 'burn-spike');
  assert.strictEqual(alerts[0].severity, 'warning');
  assert.strictEqual(alerts[0].title, 'Burn rate 2.3x your baseline');
  assert.strictEqual(alerts[0].detail, '230 tok/min vs 100 baseline');
});

test('burn spike at 2x threshold escalates to critical', () => {
  const alerts = evaluateAlerts({ ...QUIET, burnNow: 400, burnBaseline: 100 });
  assert.strictEqual(alerts[0].severity, 'critical');
});

test('waste threshold fires critical with one apply chip per finding', () => {
  const findings = [
    { id: 'unpinned-config-re-reads', title: 'Unpinned config re-reads', estSavingsPerWeek: 12 },
    { id: 'uncapped-bash-output', title: 'Uncapped bash output', estSavingsPerWeek: 6 },
  ];
  const alerts = evaluateAlerts({ ...QUIET, optimizeFindings: findings });
  assert.strictEqual(alerts.length, 1);
  const a = alerts[0];
  assert.strictEqual(a.id, 'waste-threshold');
  assert.strictEqual(a.severity, 'critical');
  assert.strictEqual(a.title, '$18/wk wasted - reclaimable');
  assert.strictEqual(a.chips.length, 2);
  assert.deepStrictEqual(a.chips[0], {
    kind: 'apply',
    label: 'fix: Unpinned config re-reads',
    findingId: 'unpinned-config-re-reads',
    title: 'Unpinned config re-reads',
  });
});

test('waste below threshold stays silent', () => {
  const findings = [{ id: 'x', title: 'X', estSavingsPerWeek: 14.9 }];
  assert.deepStrictEqual(evaluateAlerts({ ...QUIET, optimizeFindings: findings }), []);
});

test('agent ceiling fires critical per offending agent', () => {
  const agents = [
    { id: 'a1', subagentType: 'grep-sweep', tokens: 320_000 },
    { id: 'a2', subagentType: 'small-fry', tokens: 10_000 },
  ];
  const alerts = evaluateAlerts({ ...QUIET, runningAgents: agents });
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].id, 'agent-ceiling-a1');
  assert.strictEqual(alerts[0].severity, 'critical');
  assert.strictEqual(alerts[0].title, 'grep-sweep over token ceiling');
  assert.strictEqual(alerts[0].detail, '320.0k tokens - still running');
});

test('ordering: criticals first, then warnings; agents sorted by tokens desc', () => {
  const inputs = {
    ...QUIET,
    budgetVsQuota: { ...QUIET.budgetVsQuota, week: { used: 25_000_000, limit: 30_000_000 } }, // warning
    optimizeFindings: [{ id: 'f', title: 'F', estSavingsPerWeek: 20 }], // critical
    runningAgents: [
      { id: 'small', subagentType: 'a', tokens: 200_000 },
      { id: 'big', subagentType: 'b', tokens: 900_000 },
    ], // two criticals
  };
  const ids = evaluateAlerts(inputs).map((a) => a.id);
  assert.deepStrictEqual(ids, ['waste-threshold', 'agent-ceiling-big', 'agent-ceiling-small', 'budget-week']);
});

test('every alert carries non-empty why and fix strings', () => {
  const inputs = {
    ...QUIET,
    budgetVsQuota: { ...QUIET.budgetVsQuota, month: { used: 119_000_000, limit: 120_000_000 } },
    burnNow: 500,
    burnBaseline: 100,
    optimizeFindings: [{ id: 'f', title: 'F', estSavingsPerWeek: 99 }],
    runningAgents: [{ id: 'a', subagentType: 't', tokens: 999_000 }],
  };
  for (const a of evaluateAlerts(inputs)) {
    assert.ok(a.why && a.why.length > 10, `${a.id} why`);
    assert.ok(a.fix && a.fix.length > 10, `${a.id} fix`);
    assert.ok(Array.isArray(a.chips) && a.chips.length >= 1, `${a.id} chips`);
  }
});

test('plan week over threshold -> plan-week warning; at 100 -> critical', () => {
  const cfg = { enabled: true, thBudget: 78, thBurn: 99, thWaste: 1e9, thAgent: 1e9 };
  const warn = evaluateAlerts({ config: cfg, budgetVsQuota: {}, planUsage: { tier: 'pro', session: { pct: 10 }, week: { pct: 80, resetsAt: 'Mon 9am' }, weekModel: null, capturedAt: 1 } });
  assert.strictEqual(warn.length, 1);
  assert.strictEqual(warn[0].id, 'plan-week');
  assert.strictEqual(warn[0].severity, 'warning');
  assert.ok(warn[0].detail.includes('Mon 9am'));

  const crit = evaluateAlerts({ config: cfg, budgetVsQuota: {}, planUsage: { tier: 'pro', session: { pct: 10 }, week: { pct: 100, resetsAt: 'Mon' }, weekModel: null, capturedAt: 1 } });
  assert.strictEqual(crit[0].severity, 'critical');
});

test('scraped limit warning -> plan-limit-hit critical', () => {
  const cfg = { enabled: true, thBudget: 78, thBurn: 99, thWaste: 1e9, thAgent: 1e9 };
  const out = evaluateAlerts({ config: cfg, budgetVsQuota: {}, planWarnings: [{ kind: 'limit-warning', message: 'You have reached your weekly limit', resetsAt: '9am Thu', seenAt: 1 }] });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 'plan-limit-hit');
  assert.strictEqual(out[0].severity, 'critical');
});

test('no planUsage/planWarnings inputs -> no plan alerts (back-compat)', () => {
  const cfg = { enabled: true, thBudget: 78, thBurn: 99, thWaste: 1e9, thAgent: 1e9 };
  assert.deepStrictEqual(evaluateAlerts({ config: cfg, budgetVsQuota: {} }), []);
});
