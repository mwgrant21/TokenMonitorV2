// test/latestVersionReader.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readLatestVersion, LATEST_FILENAME } = require('../src/main/latestVersionReader');

async function tmpDirWith(contents) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tm-latest-'));
  if (contents !== null) await fsp.writeFile(path.join(dir, LATEST_FILENAME), contents, 'utf8');
  return dir;
}

test('reads the version from a well-formed latest.json', async () => {
  const dir = await tmpDirWith(JSON.stringify({ version: '2.2.0', notes: 'tach instruments' }));
  assert.equal(await readLatestVersion(dir), '2.2.0');
});

test('returns null for every failure mode instead of throwing', async () => {
  assert.equal(await readLatestVersion(null), null, 'no folder configured');
  assert.equal(await readLatestVersion(''), null, 'empty folder path');
  assert.equal(await readLatestVersion('/definitely/not/a/real/share'), null, 'share unreachable');
  assert.equal(await readLatestVersion(await tmpDirWith(null)), null, 'file absent');
  assert.equal(await readLatestVersion(await tmpDirWith('{ not json')), null, 'malformed JSON');
  assert.equal(await readLatestVersion(await tmpDirWith('{}')), null, 'no version field');
  assert.equal(await readLatestVersion(await tmpDirWith('{"version": 220}')), null, 'non-string version');
  assert.equal(await readLatestVersion(await tmpDirWith('{"version": ""}')), null, 'empty version');
});

test('a fleet folder with only seat snapshots yields null, not a crash', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tm-latest-'));
  await fsp.writeFile(path.join(dir, 'MGRANT.json'), '{"username":"MGRANT"}', 'utf8');
  assert.equal(await readLatestVersion(dir), null);
});
