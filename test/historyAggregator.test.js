// test/historyAggregator.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  eventTime, usageTokens, projectName, burnSeries, spendByProject,
  sessionHistory, modelSplit, weekOverWeek, forecastMonth,
} = require('../src/shared/historyAggregator');

// Factory for the normalized parsed-event shape (mirrors aggregator.test.js).
function assistantEvent({ timestamp, model = 'claude-sonnet-4-6', input = 10, output = 10, cacheCreate = 0, cacheRead = 0, cwd = 'C:\\x', sessionId = 's1', toolUses = [] }) {
  return {
    kind: 'assistant', sessionId, timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp), cwd,
    model,
    usage: { inputTokens: input, outputTokens: output, cacheCreationInputTokens: cacheCreate, cacheReadInputTokens: cacheRead },
    toolUses, toolResults: [], isHumanPrompt: false, humanText: null,
  };
}

function humanEvent(timestamp, text, { sessionId = 's1', cwd = 'C:\\x' } = {}) {
  return {
    kind: 'user', sessionId, timestamp: new Date(timestamp), cwd,
    model: null, usage: null, toolUses: [], toolResults: [], isHumanPrompt: true, humanText: text,
  };
}

function cacheEvent(timestamp, { cacheCreate = 0, cacheRead = 0, sessionId = 's1' } = {}) {
  return assistantEvent({ timestamp: new Date(timestamp), sessionId, input: 0, output: 0, cacheCreate, cacheRead });
}

const NOW = () => new Date('2026-07-10T15:00:00'); // local-time anchor, a Friday

test('eventTime handles Date, ISO string and null', () => {
  const d = new Date('2026-07-10T12:00:00Z');
  assert.strictEqual(eventTime({ timestamp: d }), d.getTime());
  assert.strictEqual(eventTime({ timestamp: '2026-07-10T12:00:00Z' }), d.getTime());
  assert.strictEqual(eventTime({ timestamp: null }), null);
  assert.strictEqual(eventTime({ timestamp: 'not-a-date' }), null);
});

test('projectName takes the last path segment of either slash style', () => {
  assert.strictEqual(projectName('C:\\Users\\IT\\claude-token-tracker'), 'claude-token-tracker');
  assert.strictEqual(projectName('/home/it/proj'), 'proj');
  assert.strictEqual(projectName(null), 'unknown');
  assert.strictEqual(projectName(''), 'unknown');
});

test('burnSeries 7d buckets by local day with day-of-week labels and finds the peak', () => {
  const events = [
    assistantEvent({ timestamp: new Date('2026-07-08T09:00:00'), input: 500, output: 500 }), // Wed
    assistantEvent({ timestamp: new Date('2026-07-08T10:00:00'), input: 1500, output: 1500 }), // Wed again
    assistantEvent({ timestamp: new Date('2026-07-10T09:00:00'), input: 100, output: 100 }), // Fri (today)
    assistantEvent({ timestamp: new Date('2026-06-30T09:00:00'), input: 9999, output: 9999 }), // outside range
  ];
  const s = burnSeries(events, { period: '7d', now: NOW });
  assert.strictEqual(s.points.length, 7);
  assert.strictEqual(s.labelEvery, 1);
  assert.strictEqual(s.points[6].label, 'Fri'); // last bucket is today
  assert.strictEqual(s.points[6].tokens, 200);
  assert.strictEqual(s.points[4].label, 'Wed');
  assert.strictEqual(s.points[4].tokens, 4000);
  assert.strictEqual(s.peakIndex, 4);
  assert.ok(s.points[4].spend > 0);
});

test('burnSeries today uses 24 hourly buckets ending now', () => {
  const events = [
    assistantEvent({ timestamp: new Date('2026-07-10T14:30:00'), input: 50, output: 50 }),
    assistantEvent({ timestamp: new Date('2026-07-09T14:00:00'), input: 999, output: 999 }), // > 24h ago
  ];
  const s = burnSeries(events, { period: 'today', now: NOW });
  assert.strictEqual(s.points.length, 24);
  assert.strictEqual(s.labelEvery, 4);
  assert.strictEqual(s.points[23].tokens, 100); // 14:30 falls in the final bucket (14:00-15:00)
  assert.strictEqual(s.points.reduce((t, p) => t + p.tokens, 0), 100);
});

test('burnSeries with no in-range events returns all-zero points and peakIndex -1', () => {
  const s = burnSeries([], { period: '30d', now: NOW });
  assert.strictEqual(s.points.length, 30);
  assert.strictEqual(s.labelEvery, 5);
  assert.strictEqual(s.peakIndex, -1);
  assert.ok(s.points.every((p) => p.tokens === 0 && p.spend === 0));
});

test('spendByProject ranks by spend, computes share pct, caps rows', () => {
  const mk = (cwd, output) => assistantEvent({ timestamp: new Date('2026-07-10T10:00:00'), cwd, input: 0, output });
  // sonnet output = $15/M -> spend proportional to output tokens
  const events = [mk('C:\\a\\api-gateway', 3_000_000), mk('C:\\a\\auth-service', 1_000_000), mk('/x/scripts', 0)];
  const rows = spendByProject(events, { sinceMs: 24 * 60 * 60 * 1000, now: NOW });
  assert.strictEqual(rows.length, 2); // zero-spend project dropped
  assert.strictEqual(rows[0].name, 'api-gateway');
  assert.strictEqual(rows[0].pct, 75);
  assert.strictEqual(rows[1].name, 'auth-service');
  assert.strictEqual(rows[1].pct, 25);
});

test('spendByProject respects the trailing window and the max cap', () => {
  const old = assistantEvent({ timestamp: new Date('2026-07-01T10:00:00'), cwd: 'C:\\old', output: 1_000_000 });
  const fresh = [];
  for (let i = 0; i < 7; i++) {
    fresh.push(assistantEvent({ timestamp: new Date('2026-07-10T10:00:00'), cwd: `C:\\p${i}`, output: (i + 1) * 100_000 }));
  }
  const rows = spendByProject([old, ...fresh], { sinceMs: 24 * 60 * 60 * 1000, now: NOW, max: 5 });
  assert.strictEqual(rows.length, 5);
  assert.ok(!rows.some((r) => r.name === 'old'));
  assert.strictEqual(rows[0].name, 'p6'); // biggest fresh spender first
});

test('sessionHistory groups by session, sorts by recency, totals tokens and spend', () => {
  const events = [
    humanEvent('2026-07-10T08:59:00', 'refactor auth middleware', { sessionId: 'sA', cwd: 'C:\\r\\api-gateway' }),
    assistantEvent({ timestamp: new Date('2026-07-10T09:00:00'), sessionId: 'sA', cwd: 'C:\\r\\api-gateway', input: 500, output: 500 }),
    humanEvent('2026-07-10T14:57:00', 'terraform module split', { sessionId: 'sB', cwd: 'C:\\r\\infra-iac' }),
    assistantEvent({ timestamp: new Date('2026-07-10T14:58:00'), sessionId: 'sB', cwd: 'C:\\r\\infra-iac', input: 100, output: 100 }),
  ];
  const rows = sessionHistory(events, { now: NOW });
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].sessionId, 'sB'); // most recent first
  assert.strictEqual(rows[0].active, true);    // 2 min ago < 5 min
  assert.strictEqual(rows[0].timeLabel, 'active');
  assert.strictEqual(rows[0].project, 'infra-iac');
  assert.strictEqual(rows[0].task, 'terraform module split');
  assert.strictEqual(rows[0].tokens, 200);
  assert.strictEqual(rows[1].sessionId, 'sA');
  assert.strictEqual(rows[1].active, false);
  assert.strictEqual(rows[1].timeLabel, '6h ago');
  assert.ok(rows[1].lastAt.startsWith('2026-07-10'));
  assert.ok(rows[1].spend > 0);
});

test('sessionHistory task is the first prompt, one line, truncated to 60 chars', () => {
  const long = `please refactor the whole\n  authentication   subsystem so that it uses the new token store everywhere`;
  const rows = sessionHistory([
    humanEvent('2026-07-10T14:00:00', long, { sessionId: 'sA' }),
    humanEvent('2026-07-10T14:05:00', 'second prompt ignored', { sessionId: 'sA' }),
  ], { now: NOW });
  assert.strictEqual(rows[0].task.length, 60);
  assert.ok(rows[0].task.endsWith('...'));
  assert.ok(!rows[0].task.includes('\n'));
  assert.ok(rows[0].task.startsWith('please refactor the whole authentication subsystem'));
});

test('sessionHistory: no prompt placeholder; null sessionId events skipped', () => {
  const rows = sessionHistory([
    assistantEvent({ timestamp: new Date('2026-07-10T14:00:00'), sessionId: 'sA' }),
    assistantEvent({ timestamp: new Date('2026-07-10T14:01:00'), sessionId: null }),
  ], { now: NOW });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].task, '(no prompt)');
});

test('sessionHistory relative time buckets: minutes, yesterday, days', () => {
  const rows = sessionHistory([
    assistantEvent({ timestamp: new Date('2026-07-10T14:30:00'), sessionId: 'm30' }),  // 30m
    assistantEvent({ timestamp: new Date('2026-07-09T13:00:00'), sessionId: 'h26' }),  // 26h -> yest.
    assistantEvent({ timestamp: new Date('2026-07-07T15:00:00'), sessionId: 'd3' }),   // 72h -> 3d
  ], { now: NOW });
  const byId = Object.fromEntries(rows.map((r) => [r.sessionId, r.timeLabel]));
  assert.strictEqual(byId.m30, '30m ago');
  assert.strictEqual(byId.h26, 'yest.');
  assert.strictEqual(byId.d3, '3d ago');
});

test('sessionHistory caps rows at max', () => {
  const events = [];
  for (let i = 0; i < 10; i++) {
    events.push(assistantEvent({ timestamp: new Date(`2026-07-10T0${i}:00:00`), sessionId: `s${i}` }));
  }
  assert.strictEqual(sessionHistory(events, { now: NOW }).length, 8);
  assert.strictEqual(sessionHistory(events, { now: NOW, max: 2 }).length, 2);
});

test('modelSplit groups by pricing tier within the window, sorted by spend', () => {
  const events = [
    assistantEvent({ timestamp: new Date('2026-07-10T10:00:00'), model: 'claude-opus-4-8', input: 0, output: 1_000_000 }),
    assistantEvent({ timestamp: new Date('2026-07-10T10:01:00'), model: 'claude-sonnet-4-6', input: 0, output: 1_000_000 }),
    assistantEvent({ timestamp: new Date('2026-07-10T10:02:00'), model: null, input: 0, output: 1_000_000 }), // default tier -> sonnet
    assistantEvent({ timestamp: new Date('2026-07-01T10:00:00'), model: 'claude-haiku-4-5', input: 0, output: 1_000_000 }), // outside window
  ];
  const split = modelSplit(events, { sinceMs: 24 * 60 * 60 * 1000, now: NOW });
  assert.strictEqual(split.length, 2);
  assert.strictEqual(split[0].tier, 'opus');   // $75 > sonnet's $30
  assert.strictEqual(split[0].tokens, 1_000_000);
  assert.strictEqual(split[1].tier, 'sonnet');
  assert.strictEqual(split[1].tokens, 2_000_000); // sonnet + unknown-model event
  assert.ok(Math.round(split[1].spend) === 30);
});

// Current week = 2026-07-03T15:00 .. 07-10T15:00; prior week = 06-26T15:00 .. 07-03T15:00 (NOW anchor).
const CUR = '2026-07-08T10:00:00';
const PREV = '2026-06-28T10:00:00';

test('weekOverWeek: burn/spend ratio >= 2 renders as N.Nx, up, bad', () => {
  const w = weekOverWeek([
    assistantEvent({ timestamp: new Date(CUR), input: 0, output: 3_000_000 }),
    assistantEvent({ timestamp: new Date(PREV), input: 0, output: 1_000_000 }),
  ], { now: NOW });
  assert.deepStrictEqual(w.burn, { dir: 'up', text: '3.0\u00d7', good: false });
  assert.deepStrictEqual(w.spend, { dir: 'up', text: '3.0\u00d7', good: false });
});

test('weekOverWeek: moderate change renders as a percentage; down-spend is good', () => {
  const w = weekOverWeek([
    assistantEvent({ timestamp: new Date(CUR), input: 0, output: 800_000 }),
    assistantEvent({ timestamp: new Date(PREV), input: 0, output: 1_000_000 }),
  ], { now: NOW });
  assert.deepStrictEqual(w.burn, { dir: 'down', text: '20%', good: true });
  assert.deepStrictEqual(w.spend, { dir: 'down', text: '20%', good: true });
});

test('weekOverWeek: noise floor and empty prior window suppress the badge', () => {
  const noisy = weekOverWeek([
    assistantEvent({ timestamp: new Date(CUR), input: 0, output: 1_005_000 }),
    assistantEvent({ timestamp: new Date(PREV), input: 0, output: 1_000_000 }),
  ], { now: NOW });
  assert.strictEqual(noisy.burn, null);
  const empty = weekOverWeek([
    assistantEvent({ timestamp: new Date(CUR), input: 0, output: 1_000_000 }),
  ], { now: NOW });
  assert.strictEqual(empty.burn, null);
  assert.strictEqual(empty.spend, null);
  assert.strictEqual(empty.cacheHit, null);
  assert.strictEqual(empty.oneShot, null);
});

test('weekOverWeek: cache hit delta in points, up is good', () => {
  const w = weekOverWeek([
    cacheEvent(CUR, { cacheRead: 500, cacheCreate: 500 }),   // 50%
    cacheEvent(PREV, { cacheRead: 200, cacheCreate: 800 }),  // 20%
  ], { now: NOW });
  assert.deepStrictEqual(w.cacheHit, { dir: 'up', text: '30pt', good: true });
});

test('weekOverWeek: one-shot delta counts corrections via isCorrection', () => {
  const w = weekOverWeek([
    // current week: 3 clean prompts, 1 correction -> 75%
    humanEvent(CUR, 'build the feature'),
    humanEvent(CUR, 'add another screen'),
    humanEvent(CUR, 'write the docs'),
    humanEvent(CUR, 'no, wrong file'),
    // prior week: 2 clean, 2 corrections -> 50%
    humanEvent(PREV, 'build something'),
    humanEvent(PREV, 'another task'),
    humanEvent(PREV, 'actually do it differently'),
    humanEvent(PREV, 'undo that'),
  ], { now: NOW });
  assert.deepStrictEqual(w.oneShot, { dir: 'up', text: '25pt', good: true });
});

test('forecastMonth projects calendar-month spend and tokens linearly', () => {
  const f = forecastMonth([
    assistantEvent({ timestamp: new Date('2026-07-05T10:00:00'), input: 0, output: 1_000_000 }), // $15, 1M tokens
    assistantEvent({ timestamp: new Date('2026-06-20T10:00:00'), input: 0, output: 9_000_000 }), // June: excluded
  ], { monthBudgetTokens: 200_000_000, now: NOW });
  // July: 31 days, 10 elapsed -> x3.1
  assert.ok(Math.abs(f.proj - 46.5) < 0.01);
  assert.ok(Math.abs(f.projTokens - 3_100_000) < 1);
  assert.strictEqual(f.over, false);
  assert.strictEqual(f.status, 'within budget');
  assert.strictEqual(f.note, 'projected month-end \u00b7 21 days left');
});

test('forecastMonth flags over-cap with a percentage', () => {
  const f = forecastMonth([
    assistantEvent({ timestamp: new Date('2026-07-05T10:00:00'), input: 0, output: 1_000_000 }),
  ], { monthBudgetTokens: 2_000_000, now: NOW });
  assert.strictEqual(f.over, true);
  assert.strictEqual(f.status, '55% over cap'); // 3.1M / 2M -> +55%
});
