// test/fleetAggregator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { seatsChipCounts, teamWaste, deptTotals } = require('../src/shared/fleetAggregator');

const SEATS = [
  { username: 'alice', stale: false, runningAgents: 2, spend: 40, cacheHitRate: 0.8, oneShotRate: 0.7,
    optimizeFindings: [{ id: 'opus-on-trivial-turns', title: 'Opus on trivial turns', estSavingsPerWeek: 12 }] },
  { username: 'bob', stale: false, runningAgents: 0, spend: 10, cacheHitRate: 0.6, oneShotRate: null,
    optimizeFindings: [
      { id: 'opus-on-trivial-turns', title: 'Opus on trivial turns', estSavingsPerWeek: 8 },
      { id: 'uncapped-bash-output', title: 'Uncapped bash output', estSavingsPerWeek: 3 },
    ] },
  { username: 'carol', stale: true, runningAgents: 5, spend: 99, cacheHitRate: 0.9, oneShotRate: 0.9,
    optimizeFindings: [{ id: 'uncapped-bash-output', title: 'Uncapped bash output', estSavingsPerWeek: 50 }] },
];

test('seatsChipCounts: total counts every file, reporting excludes stale, active needs agents', () => {
  assert.deepEqual(seatsChipCounts(SEATS), { total: 3, reporting: 2, active: 1 });
  assert.deepEqual(seatsChipCounts([]), { total: 0, reporting: 0, active: 0 });
  assert.deepEqual(seatsChipCounts(undefined), { total: 0, reporting: 0, active: 0 });
});

test('teamWaste: merges by id across non-stale seats, sums savings, sorts desc', () => {
  const waste = teamWaste(SEATS);
  assert.deepEqual(waste, [
    { id: 'opus-on-trivial-turns', title: 'Opus on trivial turns', seatCount: 2, totalPerWeek: 20 },
    { id: 'uncapped-bash-output', title: 'Uncapped bash output', seatCount: 1, totalPerWeek: 3 },
  ]);
});

test('teamWaste: tolerates missing/malformed findings arrays', () => {
  assert.deepEqual(teamWaste([{ stale: false }, { stale: false, optimizeFindings: [null, { noId: true }] }]), []);
  assert.deepEqual(teamWaste(undefined), []);
});

test('deptTotals: sums spend and averages rates over non-stale seats, skipping null metrics', () => {
  const t = deptTotals(SEATS);
  assert.equal(t.spend, 50);
  assert.equal(t.reporting, 2);
  assert.ok(Math.abs(t.avgCacheHitRate - 0.7) < 1e-9);
  assert.ok(Math.abs(t.avgOneShotRate - 0.7) < 1e-9); // only alice reports oneShotRate
});

test('deptTotals: empty input -> zero spend, null averages', () => {
  assert.deepEqual(deptTotals([]), { spend: 0, avgCacheHitRate: null, avgOneShotRate: null, reporting: 0 });
});
