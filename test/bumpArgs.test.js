// test/bumpArgs.test.js
// The version bump is the one step in `npm run dist` that rewrites package.json, so
// what it decides has to be inspectable without cutting a build to find out.
const test = require('node:test');
const assert = require('node:assert');

const { bumpArgs } = require('../scripts/bumpArgs');

test('an alpha build stays an alpha: the current prerelease tag is carried forward', () => {
  assert.deepStrictEqual(bumpArgs('2.0.0-alpha.0', []), ['--prerelease', 'alpha']);
});

test('a stable version bumps normally, with no prerelease tag invented', () => {
  assert.deepStrictEqual(bumpArgs('2.1.7', []), []);
});

test('an explicit --prerelease wins: the caller is graduating or renaming the channel', () => {
  assert.deepStrictEqual(bumpArgs('2.0.0-alpha.0', ['--prerelease', 'beta']), ['--prerelease', 'beta']);
});

test('an explicit --release-as wins: the caller named the version outright', () => {
  assert.deepStrictEqual(bumpArgs('2.0.0-alpha.0', ['--release-as', 'minor']), ['--release-as', 'minor']);
});

test('unrelated flags are preserved alongside the carried-forward tag', () => {
  assert.deepStrictEqual(bumpArgs('2.0.0-alpha.0', ['--dry-run']), ['--dry-run', '--prerelease', 'alpha']);
});

test('a version that parses to no prerelease tag adds nothing, even if it looks odd', () => {
  assert.deepStrictEqual(bumpArgs('2.0.0+build.7', []), []);
});
