// test/usageParser.test.js
//
// CALIBRATION vs the brief's sample fixtures: the real fixture
// (test/fixtures/usage-pane-real.txt, captured in Task 1) shows each meter
// as a SINGLE run-together line - bar glyphs directly between the label and
// the percent (no space), the percent directly against "used" (no space:
// "46%used" not "46% used"), and "used" directly against the next "Resets"
// line (no newline: "usedResets 1:19am ..."). The brief's synthetic panes
// used separate lines per field ("Current session" / "37% used" / "Resets
// ..." each on their own line with a real space before "used"). Synthetic
// fixtures below are rewritten to the run-together single-line shape so the
// tests exercise the same layout as production input. '#' stands in for the
// bar glyphs (real bars are Unicode block-drawing characters; a plain ASCII
// stand-in is fine here per the task brief).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseUsagePane, parseLimitWarnings } = require('../src/shared/usageParser');

const MAX_PANE = [
  'Current session##########37%usedResets 3pm (America/Denver)',
  'Current week (all models)####18%usedResets Thu, Jul 16, 9am (America/Denver)',
  'Current week (Fable)#9%usedResets Thu, Jul 16, 9am (America/Denver)',
].join('\n');

const PRO_PANE = [
  'Current session############61%usedResets 8pm (America/Denver)',
  'Current week (all models)###############72%usedResets Mon, Jul 14, 9am (America/Denver)',
].join('\n');

// Mimics the real fixture's repaint behavior: the pane redraws multiple times
// while open, with an earlier "scanning" frame showing stale/partial numbers
// (45/39) followed by a settled frame (46/40/63). The parser must return the
// LAST match of each meter, not the first.
const REPAINT_BUFFER = [
  'Current session#####################45%usedResets 1:20am (America/Denver)',
  'Current week (all models)###################39%usedResets Jul 11, 7pm (America/Denver)',
  '',
  'Current session#######################46%usedResets 1:19am (America/Denver)',
  'Current week (all models)####################40%usedResets Jul 11, 6:59pm (America/Denver)',
  'Current week (Fable)###########################63%usedResets Jul 11, 6:59pm (America/Denver)',
].join('\n');

test('parses a Max pane: tier, session, week, model bar, reset string', () => {
  const r = parseUsagePane(MAX_PANE);
  assert.ok(r);
  assert.strictEqual(r.tier, 'max');
  assert.strictEqual(r.session.pct, 37);
  assert.strictEqual(r.week.pct, 18);
  assert.strictEqual(r.weekModel.pct, 9);
  assert.ok(r.week.resetsAt.includes('Jul 16'));
});

test('parses a Pro pane: single weekly bar -> tier pro, weekModel null', () => {
  const r = parseUsagePane(PRO_PANE);
  assert.ok(r);
  assert.strictEqual(r.tier, 'pro');
  assert.strictEqual(r.session.pct, 61);
  assert.strictEqual(r.week.pct, 72);
  assert.strictEqual(r.weekModel, null);
});

test('repainted buffer with two frames -> last (settled) frame numbers win', () => {
  const r = parseUsagePane(REPAINT_BUFFER);
  assert.ok(r);
  assert.strictEqual(r.tier, 'max');
  assert.strictEqual(r.session.pct, 46);
  assert.strictEqual(r.week.pct, 40);
  assert.strictEqual(r.weekModel.pct, 63);
  assert.ok(r.week.resetsAt.includes('6:59pm'));
});

test('garbage/partial input -> null (never partial output)', () => {
  assert.strictEqual(parseUsagePane('ls -la\ntotal 96\nnpm test output'), null);
  assert.strictEqual(parseUsagePane('Current session\nno percent here'), null);
  assert.strictEqual(parseUsagePane(''), null);
  assert.strictEqual(parseUsagePane(undefined), null);
});

test('pct out of range is rejected', () => {
  assert.strictEqual(parseUsagePane('Current session\n999% used\nCurrent week (all models)\n42% used'), null);
});

test('REAL fixture from this machine parses non-null with plausible values', () => {
  const real = fs.readFileSync(path.join(__dirname, 'fixtures', 'usage-pane-real.txt'), 'utf8');
  const r = parseUsagePane(real);
  assert.ok(r, 'real fixture must parse');
  assert.ok(r.session.pct >= 0 && r.session.pct <= 100);
  assert.ok(r.week.pct >= 0 && r.week.pct <= 100);
  assert.ok(typeof r.week.resetsAt === 'string' && r.week.resetsAt.length > 0);
});

test('REAL fixture: settled-frame values match documented ground truth (46/40/63, max tier)', () => {
  const real = fs.readFileSync(path.join(__dirname, 'fixtures', 'usage-pane-real.txt'), 'utf8');
  const r = parseUsagePane(real);
  assert.ok(r);
  assert.strictEqual(r.tier, 'max');
  assert.strictEqual(r.session.pct, 46);
  assert.strictEqual(r.week.pct, 40);
  assert.strictEqual(r.weekModel.pct, 63);
  assert.ok(r.week.resetsAt.includes('Jul 11'));
});

test('parseLimitWarnings finds inline limit lines with reset info', () => {
  const out = parseLimitWarnings('some output\nYou have reached your weekly limit. Your limit will reset at 9am Thu.\nmore output');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].kind, 'limit-warning');
  assert.ok(/weekly limit/i.test(out[0].message));
  assert.ok(out[0].resetsAt.includes('9am'));
});

test('parseLimitWarnings: approaching-limit wording also matches', () => {
  const out = parseLimitWarnings('Approaching weekly limit - 10% remaining');
  assert.strictEqual(out.length, 1);
});

test('parseLimitWarnings: normal output -> empty array', () => {
  assert.deepStrictEqual(parseLimitWarnings('regular assistant output with the word limitless'), []);
  assert.deepStrictEqual(parseLimitWarnings(''), []);
});

test('parseLimitWarnings: quoted/code-ish text does not fire (false-positive regression)', () => {
  // Cat-ing this repo's own test file used to fire a critical alert here.
  const out = parseLimitWarnings("assert.ok(/weekly limit/i.test('You have reached your weekly limit. resets at 9am'));");
  assert.deepStrictEqual(out, []);
});

// A run-together repaint frame: one line, no newline between the settled
// session meter's reset and the next meter's label, ending in extra prose
// (mirrors the real fixture's mid-repaint lines). resetsAt must be bounded
// to the parenthesized zone, not swallow the rest of the line.
const RUN_TOGETHER_FRAME =
  "Current session##########37%usedResets 1:20am (America/Denver)Current week (all models)####18%usedResets Thu, Jul 16, 9am (America/Denver)   What's contributing to your limits usage? Scanning local sessions... Esc to cancel";

test('run-together frame: resetsAt is bounded to the clean parenthesized string', () => {
  const r = parseUsagePane(RUN_TOGETHER_FRAME);
  assert.ok(r);
  assert.strictEqual(r.week.resetsAt, 'Thu, Jul 16, 9am (America/Denver)');
  assert.ok(r.week.resetsAt.length < 40);
});
