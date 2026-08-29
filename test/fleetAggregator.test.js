// test/fleetAggregator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { seatsChipCounts, teamWaste, deptTotals, versionSpread } = require('../src/shared/fleetAggregator');

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

// --- versionSpread: the Team view's version column and N-seats-behind chip ---
// Reference point is the newest version any seat reports, not latest.json: this
// answers "is the fleet consistent with itself", which is the question you have when
// half the department is on a build you handed out last month.
test('versionSpread of no seats reports nothing rather than guessing', () => {
  assert.deepEqual(versionSpread([]), { newest: null, distribution: [], behind: 0, unknown: 0 });
});

test('versionSpread with every seat on one version has nobody behind', () => {
  const spread = versionSpread([
    { username: 'a', appVersion: '2.1.7' },
    { username: 'b', appVersion: '2.1.7' },
  ]);
  assert.equal(spread.newest, '2.1.7');
  assert.equal(spread.behind, 0);
  assert.deepEqual(spread.distribution, [{ version: '2.1.7', count: 2 }]);
});

test('versionSpread counts seats older than the newest as behind', () => {
  const spread = versionSpread([
    { username: 'a', appVersion: '2.2.0' },
    { username: 'b', appVersion: '2.1.7' },
    { username: 'c', appVersion: '2.1.7' },
  ]);
  assert.equal(spread.newest, '2.2.0');
  assert.equal(spread.behind, 2);
});

test('versionSpread orders the distribution newest first, not lexically', () => {
  // 2.1.10 sorts before 2.1.7 as a string; that is the bug this ordering exists to avoid.
  const spread = versionSpread([
    { username: 'a', appVersion: '2.1.7' },
    { username: 'b', appVersion: '2.1.10' },
  ]);
  assert.deepEqual(spread.distribution.map((d) => d.version), ['2.1.10', '2.1.7']);
  assert.equal(spread.newest, '2.1.10');
});

// Compatibility: a snapshot written before this feature existed has no appVersion at
// all. It must read as unknown -- never as a version, and never as behind, because we
// genuinely cannot tell.
test('versionSpread treats a seat with no appVersion as unknown, not as behind', () => {
  const spread = versionSpread([
    { username: 'a', appVersion: '2.2.0' },
    { username: 'b' },
  ]);
  assert.equal(spread.unknown, 1);
  assert.equal(spread.behind, 0);
  assert.equal(spread.newest, '2.2.0');
});

test('versionSpread treats an unparseable version as unknown', () => {
  const spread = versionSpread([{ username: 'a', appVersion: 'unknown' }]);
  assert.equal(spread.unknown, 1);
  assert.equal(spread.newest, null);
  assert.deepEqual(spread.distribution, [{ version: 'unknown', count: 1 }]);
});

test('versionSpread puts the unknown bucket last, after every real version', () => {
  const spread = versionSpread([
    { username: 'a', appVersion: 'unknown' },
    { username: 'b', appVersion: '2.1.7' },
  ]);
  assert.deepEqual(spread.distribution.map((d) => d.version), ['2.1.7', 'unknown']);
});

test('versionSpread ignores stale seats, like every other roll-up here', () => {
  const spread = versionSpread([
    { username: 'a', appVersion: '2.2.0' },
    { username: 'b', appVersion: '2.0.0', stale: true },
  ]);
  assert.equal(spread.behind, 0);
  assert.deepEqual(spread.distribution, [{ version: '2.2.0', count: 1 }]);
});
