// test/buildInfo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const pkg = require('../package.json');
const {
  buildBuildInfo,
  readBuildInfo,
  UNKNOWN_BUILD_INFO,
  BUILD_INFO_FILENAME,
} = require('../src/shared/buildInfo');

const SHA = 'a3f9c21b7e4d5068fbb1c2a9d0e7f3128c4a5b6d';

async function tmpFileWith(contents) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tm-buildinfo-'));
  const file = path.join(dir, BUILD_INFO_FILENAME);
  if (contents !== null) await fsp.writeFile(file, contents, 'utf8');
  return file;
}

test('the builder produces version, commit, builtAt and channel', () => {
  const info = buildBuildInfo({ commit: SHA });
  assert.deepEqual(Object.keys(info).sort(), ['builtAt', 'channel', 'commit', 'version']);
});

test('the version comes from package.json, so no semver literal is needed elsewhere', () => {
  assert.equal(buildBuildInfo({ commit: SHA }).version, pkg.version);
});

test('commit is normalized to a short sha', () => {
  assert.equal(buildBuildInfo({ commit: SHA }).commit, 'a3f9c21');
  assert.equal(buildBuildInfo({ commit: 'a3f9c21' }).commit, 'a3f9c21', 'already short stays put');
  assert.equal(buildBuildInfo({ commit: '  a3f9c21\n' }).commit, 'a3f9c21', 'git output is trimmed');
});

test('an unreadable commit degrades to unknown rather than to a plausible sha', () => {
  for (const bad of [undefined, null, '', 'not-a-sha', 'zzzzzzz', 42, {}]) {
    assert.equal(
      buildBuildInfo({ commit: bad }).commit,
      'unknown',
      `expected unknown for ${JSON.stringify(bad)}`
    );
  }
});

test('builtAt parses as a date', () => {
  const info = buildBuildInfo({ commit: SHA, builtAt: new Date('2026-08-29T20:21:00.000Z') });
  assert.equal(info.builtAt, '2026-08-29T20:21:00.000Z');
  assert.ok(Number.isFinite(Date.parse(buildBuildInfo({ commit: SHA }).builtAt)));
});

test('channel is derived from the version prerelease tag, not hand-set', () => {
  assert.equal(buildBuildInfo({ commit: SHA, version: '2.0.0-alpha.0' }).channel, 'alpha');
  assert.equal(buildBuildInfo({ commit: SHA, version: '2.0.0-beta.3' }).channel, 'beta');
  assert.equal(buildBuildInfo({ commit: SHA, version: '2.0.0-rc.1' }).channel, 'rc');
  assert.equal(buildBuildInfo({ commit: SHA, version: '2.0.0' }).channel, 'stable');
});

test('a written buildInfo.json round-trips through the reader', async () => {
  const info = buildBuildInfo({ commit: SHA });
  const file = await tmpFileWith(JSON.stringify(info));
  assert.deepEqual(readBuildInfo(file), info);
});

test('an absent file yields the unknown shape, never a plausible version', async () => {
  const file = await tmpFileWith(null);
  assert.deepEqual(readBuildInfo(file), UNKNOWN_BUILD_INFO);
  assert.equal(readBuildInfo(file).version, 'unknown');
  assert.notEqual(readBuildInfo(file).version, pkg.version, 'a dev run must not claim a build version');
});

test('every other unreadable case collapses to unknown too', async () => {
  assert.deepEqual(readBuildInfo(null), UNKNOWN_BUILD_INFO, 'no path');
  assert.deepEqual(readBuildInfo(''), UNKNOWN_BUILD_INFO, 'empty path');
  assert.deepEqual(readBuildInfo(await tmpFileWith('{ not json')), UNKNOWN_BUILD_INFO, 'malformed');
  assert.deepEqual(readBuildInfo(await tmpFileWith('{}')), UNKNOWN_BUILD_INFO, 'no version field');
  assert.deepEqual(readBuildInfo(await tmpFileWith('{"version":""}')), UNKNOWN_BUILD_INFO, 'empty version');
  assert.deepEqual(readBuildInfo(await tmpFileWith('{"version":42}')), UNKNOWN_BUILD_INFO, 'non-string version');
});

test('a file carrying a version but missing the rest fills the gaps, it does not discard the version', async () => {
  const file = await tmpFileWith('{"version":"2.0.0-alpha.0"}');
  assert.deepEqual(readBuildInfo(file), {
    version: '2.0.0-alpha.0',
    commit: 'unknown',
    builtAt: null,
    channel: 'unknown',
  });
});

test('the unknown shape carries every field the builder produces', () => {
  assert.deepEqual(Object.keys(UNKNOWN_BUILD_INFO).sort(), ['builtAt', 'channel', 'commit', 'version']);
});
