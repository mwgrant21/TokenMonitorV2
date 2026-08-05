// src/shared/usageParser.js
// Pure, tolerant parsers over ANSI-stripped pty text. Fixture-first: the
// patterns are calibrated against test/fixtures/usage-pane-real.txt. On
// anything unrecognizable they return null/[] - never partial garbage.
//
// CALIBRATION vs the original brief sample: the real fixture shows each
// meter as a single run-together line - bar glyphs directly between the
// label and the percent, then the percent directly against "used" (no
// space), and "used" directly against "Resets" (no space either), e.g.
// (using [bar] as an ASCII stand-in for the Unicode block-drawing glyphs):
//   Current session[bar]46%usedResets 1:19am (America/Denver)
// The label-to-percent gap (label text + bar glyphs) can run up to ~127
// chars in a mid-repaint frame (extra whitespace padding before the bar),
// so the brief's {0,120} skip is widened to {0,150} here. (Bar glyphs are
// Unicode block-drawing characters in the real fixture; kept out of this
// source file's comments to stay ASCII-clean - see the fixture file itself
// for the literal bytes.)

const PCT = '(\\d{1,3})\\s*%\\s*used'; // real fixture shows 'NN%used' (no space); \s* covers both
const SESSION_RE = new RegExp('Current session[\\s\\S]{0,150}?' + PCT, 'i');
const WEEK_ALL_RE = new RegExp('Current week \\(all models\\)[\\s\\S]{0,150}?' + PCT, 'i');
const WEEK_MODEL_RE = new RegExp('Current week \\((?!all models)[^)]+\\)[\\s\\S]{0,150}?' + PCT, 'i');
// Bounded through the first closing paren: both real formats end with a
// zone in parens, e.g. "(America/Denver)". Unbounded [^\n]+ previously
// swallowed bar glyphs / the next meter / "Esc to cancel" on run-together
// repaint lines that lack a newline before the next frame.
const RESET_RE = /Resets\s+([^\n(]{0,40}\([^)\n]{0,40}\))/gi;

function pctOk(n) {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

// parseUsagePane(text) -> snapshot fields or null
// The pane repaints while open: always use the LAST occurrence of each
// meter (settled frame), never the first.
function lastMatch(re, t) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m = null;
  let cur;
  while ((cur = g.exec(t)) !== null) m = cur;
  return m;
}

function parseUsagePane(text) {
  const t = typeof text === 'string' ? text : '';
  const session = lastMatch(SESSION_RE, t);
  const week = lastMatch(WEEK_ALL_RE, t);
  if (!session || !week) return null;
  const sessionPct = Number(session[1]);
  const weekPct = Number(week[1]);
  if (!pctOk(sessionPct) || !pctOk(weekPct)) return null;

  const model = lastMatch(WEEK_MODEL_RE, t);
  const modelPct = model ? Number(model[1]) : null;
  if (model && !pctOk(modelPct)) return null;

  // Reset string: the one nearest AFTER the weekly-all match, else the last seen.
  let resetsAt = '';
  let m;
  RESET_RE.lastIndex = 0;
  while ((m = RESET_RE.exec(t)) !== null) {
    resetsAt = m[1].trim();
    if (m.index > week.index) break;
  }
  if (!resetsAt) return null;

  return {
    tier: model ? 'max' : 'pro',
    session: { pct: sessionPct },
    week: { pct: weekPct, resetsAt },
    weekModel: model ? { pct: modelPct } : null,
  };
}

// Loosest pattern (`limit (was )?hit[^\n]*`) removed - it fired on ordinary
// terminal traffic (e.g. cat-ing this repo's own test file). Tails bounded
// to 140 chars so a match can never run away across an entire buffer.
const WARNING_RES = [
  /(reached|hit) your (weekly|session|5-hour)[^\n]{0,140}limit[^\n]{0,140}/i,
  /approaching (your )?(weekly|session|5-hour)[^\n]{0,140}limit[^\n]{0,140}/i,
];
const WARN_RESET_RE = /reset[s]?\s(?:at\s)?([^\n.]+)/i;

// parseLimitWarnings(text) -> [{ kind, message, resetsAt|null }]
function parseLimitWarnings(text) {
  const t = typeof text === 'string' ? text : '';
  const out = [];
  for (const re of WARNING_RES) {
    const m = re.exec(t);
    if (!m) continue;
    // Quoted/code-ish text (a source line, not a real CLI warning) - skip it.
    if (/['"`]/.test(m[0])) continue;
    const reset = WARN_RESET_RE.exec(m[0]);
    out.push({ kind: 'limit-warning', message: m[0].trim(), resetsAt: reset ? reset[1].trim() : null });
    break; // one warning per scan is enough; dedupe happens upstream
  }
  return out;
}

module.exports = { parseUsagePane, parseLimitWarnings };
