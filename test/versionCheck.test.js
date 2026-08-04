// test/versionCheck.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVersion, compareVersions, deriveVersionStatus } = require('../src/shared/versionCheck');

test('parseVersion accepts bare, v-prefixed, short and build-tagged versions', () => {
  assert.deepEqual(parseVersion('2.1.7'), [2, 1, 7]);
  assert.deepEqual(parseVersion('v2.1.7'), [2, 1, 7]);
  assert.deepEqual(parseVersion(' 2.1.7 '), [2, 1, 7]);
  assert.deepEqual(parseVersion('2.1'), [2, 1, 0]);
  assert.deepEqual(parseVersion('2'), [2, 0, 0]);
  assert.deepEqual(parseVersion('2.1.7+a3f9c21'), [2, 1, 7]);
  assert.deepEqual(parseVersion('2.1.7-rc.1'), [2, 1, 7]);
});

test('parseVersion rejects junk rather than guessing', () => {
  for (const bad of ['', 'abc', '2.x.1', null, undefined, 42, {}, '..', '1.2.3.4']) {
    assert.equal(parseVersion(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('compareVersions orders correctly across each component', () => {
  assert.equal(compareVersions('2.1.7', '2.1.7'), 0);
  assert.equal(compareVersions('2.1.7', '2.2.0'), -1);
  assert.equal(compareVersions('2.2.0', '2.1.7'), 1);
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
  assert.equal(compareVersions('2.1.7', '2.1.10'), -1, 'numeric compare, not lexical');
  assert.equal(compareVersions('2.1', '2.1.0'), 0);
});

test('compareVersions returns null when either side is unparseable', () => {
  assert.equal(compareVersions('2.1.7', 'garbage'), null);
  assert.equal(compareVersions(null, '2.1.7'), null);
});

test('deriveVersionStatus: current when equal or ahead of published', () => {
  assert.equal(deriveVersionStatus('2.1.7', '2.1.7').state, 'current');
  assert.equal(deriveVersionStatus('2.2.0', '2.1.7').state, 'current', 'a local dev build ahead of the share is not "behind"');
});

test('deriveVersionStatus: behind, and names the bump size', () => {
  assert.deepEqual(deriveVersionStatus('2.1.7', '2.1.9'), { state: 'behind', current: '2.1.7', latest: '2.1.9', behindBy: 'patch' });
  assert.equal(deriveVersionStatus('2.1.7', '2.2.0').behindBy, 'minor');
  assert.equal(deriveVersionStatus('2.1.7', '3.0.0').behindBy, 'major');
});

test('deriveVersionStatus: unknown is distinct from current and never masquerades as it', () => {
  for (const [cur, lat] of [['2.1.7', null], ['2.1.7', ''], ['2.1.7', 'nope'], [null, '2.2.0'], [null, null]]) {
    const s = deriveVersionStatus(cur, lat);
    assert.equal(s.state, 'unknown', `expected unknown for ${cur} / ${lat}`);
    assert.notEqual(s.state, 'current');
    assert.equal(s.behindBy, null);
  }
});
