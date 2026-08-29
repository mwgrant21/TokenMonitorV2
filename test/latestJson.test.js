// test/latestJson.test.js
// The producer for src/main/latestVersionReader.js, which has been reading this file
// since 2026-08-13 with nothing writing it. The two are only useful if they agree, so
// the contract is asserted from both ends: this builds the payload, and the reader's
// own parse is run over it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLatestJson } = require('../scripts/latestJson');

test('carries the version the build was cut at', () => {
  const payload = buildLatestJson({ version: '2.0.0-alpha.1', builtAt: '2026-08-29T20:00:00.000Z' });
  assert.equal(payload.version, '2.0.0-alpha.1');
});

test('publishes the date the build was cut, not the day the file is copied', () => {
  const payload = buildLatestJson({ version: '2.0.0-alpha.1', builtAt: '2026-08-29T20:00:00.000Z' });
  assert.equal(payload.published, '2026-08-29');
});

test('omits notes rather than writing an empty string nobody wrote', () => {
  assert.ok(!('notes' in buildLatestJson({ version: '2.0.0-alpha.1', builtAt: '2026-08-29T20:00:00.000Z' })));
});

test('keeps notes when the release actually has some', () => {
  const payload = buildLatestJson({ version: '2.0.0-alpha.1', builtAt: '2026-08-29T20:00:00.000Z', notes: 'tach instruments' });
  assert.equal(payload.notes, 'tach instruments');
});
