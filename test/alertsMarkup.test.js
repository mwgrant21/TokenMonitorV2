const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('critical and warning alert rows use different accent colors', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'dashboard.css'), 'utf8');
  const criticalRule = css.match(/\.alert-row\.critical\s*\{[^}]*\}/);
  const warningRule = css.match(/\.alert-row\.warning\s*\{[^}]*\}/);
  assert.ok(criticalRule && warningRule, 'expected both .alert-row.critical and .alert-row.warning rules to exist');
  assert.ok(criticalRule[0].includes('--danger'), '.alert-row.critical should use --danger, not --warn');
});

// --- follow-up 11: renderWithMemo must actually memoize -------------------
// main.js pushes a fresh dashboard:update object about every 1000ms. These
// tests load the real panel into a minimal DOM stub and count innerHTML
// writes, because a source-text assertion cannot tell a real memo from a
// stub that stashes state and rewrites anyway - which is exactly the bug.

const vm = require('node:vm');

function makeEl() {
  let html = '';
  const el = {
    style: {},
    writes: 0,
    addEventListener() {},
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; el.writes += 1; },
  };
  return el;
}

function loadAlertsPanel() {
  const dir = path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels');
  const banner = makeEl();
  const toast = makeEl();
  const win = { TT: {} };
  const ctx = vm.createContext({
    window: win,
    document: {
      getElementById(id) {
        if (id === 'alerts-banner') return banner;
        if (id === 'cli-toast') return toast;
        return null;
      },
    },
    setTimeout,
  });
  // format.js first: escapeHtml is a bare global that alerts.js calls.
  for (const file of ['format.js', 'alerts.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), ctx, { filename: file });
  }
  return { panel: win.TT.alertsPanel, banner, toast };
}

// Fresh object every call on purpose: identity comparison must not be enough.
function budgetAlert(overrides) {
  return Object.assign({
    id: 'budget-week',
    severity: 'critical',
    title: 'Weekly budget exceeded',
    detail: '$41.20 of $30.00',
    why: 'Spend crossed the configured weekly ceiling.',
    fix: 'Raise the ceiling or trim context.',
    chips: [{ label: 'Open budgets', kind: 'copy', text: 'budgets' }],
  }, overrides || {});
}

function tick(alerts) {
  return { alertsEnabled: true, alerts: alerts || [budgetAlert()] };
}

test('re-rendering an unchanged alert state does not rewrite the banner', () => {
  const { panel, banner } = loadAlertsPanel();
  panel.render(tick());
  assert.equal(banner.writes, 1, 'the first render should write the banner once');
  panel.render(tick());
  panel.render(tick());
  assert.equal(banner.writes, 1, 'banner innerHTML was rewritten on an unchanged tick');
});

test('re-rendering an unchanged alert state does not rewrite the CLI toast', () => {
  const { panel, toast } = loadAlertsPanel();
  panel.render(tick());
  assert.equal(toast.writes, 1, 'the first render should write the toast once');
  panel.render(tick());
  panel.render(tick());
  assert.equal(toast.writes, 1, 'toast innerHTML was rewritten on an unchanged tick');
});

test('a newly firing alert still rewrites the banner', () => {
  const { panel, banner } = loadAlertsPanel();
  panel.render(tick());
  panel.render(tick());
  const settled = banner.writes;
  panel.render(tick([budgetAlert(), budgetAlert({ id: 'cache-hit-low', severity: 'warning', title: 'Cache hit rate low' })]));
  assert.equal(banner.writes, settled + 1, 'a changed alert set must re-render the banner');
});

test('a change to the most severe alert rewrites the CLI toast', () => {
  const { panel, toast } = loadAlertsPanel();
  panel.render(tick());
  panel.render(tick());
  const settled = toast.writes;
  panel.render(tick([budgetAlert({ detail: '$52.90 of $30.00' })]));
  assert.equal(toast.writes, settled + 1, 'a changed top alert must re-render the toast');
});

// --- follow-up 11, second half: the entrance animation stays out ---------
// Task 4 added `animation: bannerIn .25s ease` for a one-time entrance; d12a6fe
// removed it because the banner rebuilt every second. Memoizing the render was
// necessary but is NOT sufficient to bring it back: alertEngine embeds live
// figures in title/detail (budget percent, tok/min, fmtTokens), so the memo key
// legitimately changes as those numbers move and the row is legitimately
// rebuilt. The animation cannot return until rows reconcile in place - see
// docs/follow-ups.md item 11. This test holds that line.

function alertRowRules(css) {
  // Strip comments first: the note above these rules discusses `animation` in prose,
  // and an uncommented scan would match across it into the rule that follows.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return stripped.match(/\.alert-row[^{}]*\{[^}]*\}/g) || [];
}

test('no .alert-row rule carries an entrance animation', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'dashboard.css'), 'utf8');
  const rules = alertRowRules(css);
  assert.ok(rules.length > 0, 'expected at least one .alert-row rule');
  for (const rule of rules) {
    assert.ok(!/animation/.test(rule),
      `.alert-row must not animate until rows reconcile in place - offending rule: ${rule.slice(0, 120)}`);
  }
});

test('the bannerIn keyframes stay defined for the follow-up that re-applies them', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'dashboard.css'), 'utf8');
  assert.match(css, /@keyframes\s+bannerIn\s*\{/, '@keyframes bannerIn is deliberately kept for follow-up 11');
});
