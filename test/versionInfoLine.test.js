// test/versionInfoLine.test.js
// The line this builds is the whole point of the feature: someone is asked "what
// version are you on?" and pastes one string back. docs/design/aether-convergence-plan.md
// is explicit about the failure mode -- they read back the Claude Code version by
// mistake, or give a number with no build so you still cannot tell which of two builds
// they have. So the product name and the build are not decoration, they are the
// requirement, and there is a test for each.
const test = require('node:test');
const assert = require('node:assert');

const { versionInfoLine } = require('../src/shared/versionInfoLine');

const FULL = {
  version: '2.1.7',
  commit: 'a3f9c21',
  builtAt: '2026-07-28T14:02:00.000Z',
  seat: 'MGRANT',
  os: 'Windows 11 Home',
};

test('builds the documented line', () => {
  assert.strictEqual(
    versionInfoLine(FULL),
    'Token Tracker v2.1.7 (build a3f9c21) · seat MGRANT · Windows 11 Home · built 28 Jul 2026'
  );
});

test('names the product, so a pasted line cannot be mistaken for another tool version', () => {
  assert.ok(versionInfoLine(FULL).includes('Token Tracker'));
});

test('is one line: it gets pasted into a chat box', () => {
  assert.ok(!/[\r\n]/.test(versionInfoLine(FULL)));
});

test('an unknown commit drops the build segment rather than printing "build unknown"', () => {
  const line = versionInfoLine({ ...FULL, commit: 'unknown' });
  assert.ok(!line.includes('build'), line);
  assert.ok(line.startsWith('Token Tracker v2.1.7 · seat MGRANT'), line);
});

test('a missing seat leaves no dangling separator', () => {
  assert.strictEqual(
    versionInfoLine({ ...FULL, seat: null }),
    'Token Tracker v2.1.7 (build a3f9c21) · Windows 11 Home · built 28 Jul 2026'
  );
});

test('a missing build date leaves no dangling separator', () => {
  assert.strictEqual(
    versionInfoLine({ ...FULL, builtAt: null }),
    'Token Tracker v2.1.7 (build a3f9c21) · seat MGRANT · Windows 11 Home'
  );
});

test('an unparseable build date is dropped rather than printed as Invalid Date', () => {
  const line = versionInfoLine({ ...FULL, builtAt: 'sometime last Tuesday' });
  assert.ok(!line.includes('built'), line);
  assert.ok(!line.includes('Invalid'), line);
});

// The dev-run case. An app that does not know its own version still has to say which
// app it is -- a bare "unknown" pasted into a chat is useless to whoever receives it.
test('a build that does not know its version still names the product', () => {
  const line = versionInfoLine({ version: 'unknown', commit: 'unknown', builtAt: null, seat: 'MGRANT', os: 'Windows 11 Home' });
  assert.strictEqual(line, 'Token Tracker vunknown · seat MGRANT · Windows 11 Home');
});

test('the product name is overridable but defaults without being passed', () => {
  assert.ok(versionInfoLine({ ...FULL, productName: 'Token Tracker (dept build)' })
    .startsWith('Token Tracker (dept build) v2.1.7'));
});

test('the date is formatted from the instant, not the reader local midnight', () => {
  // 23:30 UTC on the 28th is already the 29th in some zones and still the 27th in
  // others. Pinning to UTC keeps two people comparing pasted lines from disagreeing
  // about which day a build was cut.
  assert.ok(versionInfoLine({ ...FULL, builtAt: '2026-07-28T23:30:00.000Z' }).endsWith('built 28 Jul 2026'));
});
