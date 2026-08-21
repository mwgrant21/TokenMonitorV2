# Reskin Phase 5 (5 real slices) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the five dashboard panels the prototype actually specifies — Hero tiles, Budgets
(plus the `--alarm` unification), Agents lanes + Task breakdown + Treemap, Alerts banner + CLI toast,
and Optimize — from v1's JetBrains-Mono-everywhere look to the Aether visual language already proven
by the chrome pass (reskin-phases-3-4).

**Architecture:** Each task edits one panel's render function (`src/renderer/dashboard/panels/*.js`)
and its CSS in `src/renderer/dashboard/dashboard.css`. No new files, no new panels, no new IPC surface.
Existing class names are kept (`.hero-tile`, `.budget-row`, `.agent-lane`, `.task-row`,
`.treemap-block`, `.alert-row`, `.optimize-card`, …) — only their declarations change, matching the
convention Task 7 of reskin-phases-3-4 already established for `.hdr`/`.footer` (adopt the prototype's
CSS *values* onto our own class names, don't rename to match the prototype's markup). `dashboard.js`'s
state fan-out (`render(state)` calling `window.TT.<panel>.render(state)`) is untouched — every panel
already receives precomputed state and renders synchronously; none of these five needs new data.

**Tech Stack:** Same as reskin-phases-3-4 — plain CSS custom properties from `tokens.css`, classic
`<script>` panels with `window.TT.<name> = { render }`, `node --test` for structural/contrast checks,
Electron+Playwright (temporary `npm install --no-save playwright-core`) for live verification.

## Global Constraints

- **Branch:** `reskin-phase-5`, branched off `reskin-phases-3-4` (not yet merged to `main` — this
  branch needs everything in that PR as a base). Rebase onto `main` once PR #1 merges; don't wait for
  that to start this work, since nothing here depends on unmerged file changes.
- **This plan covers 5 of the design spec's 10 named slices.** Insights, Settings-popover-content,
  Onboarding, Fleet/Team view and Mini mode have **no prototype markup at all** — verified by reading
  every line of `docs/prototype/index.html`'s `.dash` div and grepping the whole file for their class
  names (zero hits outside this app's own source). Restyling them means designing new markup within
  the Aether language, which is real design work this plan does not do. Track them as a follow-up;
  don't invent markup for them under cover of this plan.
- **The panel container chrome is already done.** Task 7 of reskin-phases-3-4 already applied the
  `panel-grad`/`panel-bd`/`r-panel`/box-shadow formula to `.hero-tile`, `.budget-panel`,
  `.agents-panel`, `.task-panel`, `.optimize-panel`, `.treemap-panel` and `.optimize-card`. This plan
  is about what's *inside* those containers — typography, bars, chips, colors — not the container
  itself. Don't re-touch `background`/`border`/`border-radius`/`box-shadow` on those six selectors.
- **No instruments.** Reactor/Arc/Tach-V/Tach-H are out of scope (separate spec, per
  `docs/design/2026-08-05-app-move-and-aether-reskin.md` §1). Where the prototype's markup for a slice
  includes a canvas-based visualization with no equivalent in our current panel (the orchestration
  graph `#ograph` in "Concurrent sessions", the donut chart `#donut` in "What tokens went to"), that
  visualization is excluded from this plan for the same reason instruments are — it's a new component,
  not a restyle of an existing one.
- **Typography tokens:** labels use `var(--f-ui)` (Rajdhani) at the weight/letter-spacing the
  prototype specifies; values/numbers/bars use `var(--f-mono)` (Space Mono). Every task below replaces
  a literal `'JetBrains Mono', monospace` font declaration — grep for `JetBrains Mono` in the file
  you're editing before you start to make sure you got all of them in scope for that task.
- **Color tokens used across these five tasks, all already defined in `tokens.css`:** `--tx-primary`,
  `--tx-secondary`, `--tx-muted`, `--tx-dim`, `--acc`, `--acc-deep`, `--acc-wash`, `--acc-glow`,
  `--panel-inset`, `--chrome-bd`, `--chip-bd`, `--active-bd`, `--success`, `--warn`, `--danger`,
  `--alarm`, `--alarm-glow`, `--r-chip`, `--r-tile`. None of these are new; all 14 palettes already
  define them (verified in reskin-phases-3-4).
- **Inline styles:** keep `style=` only for genuinely runtime-computed values (bar/fill widths,
  treemap flex-basis) — the same rule reskin-phases-3-4's Task 8 used. Every other inline style found
  during this plan gets extracted to a CSS class.
- Run `npm test` before declaring any task done. Full suite was 269/269 at the start of this plan
  (226 root + 43 `packages/core`); it must stay green, and each task adds at least one new assertion.
- **Live verification pattern** (used throughout reskin-phases-3-4, Tasks 7 and 8): `npm install
  --no-save playwright-core@1.62.1`, copy a driver script into the project root (ESM import resolution
  needs it inside `node_modules`'s tree — a script outside the project can't resolve the package),
  launch `node_modules/electron/dist/electron.exe` with the project dir as its arg (this runs the real
  `src/main/main.js`, not `loadFile` — the boot IIFE needs the preload bridge, so a bare `loadFile`
  leaves panels unmounted), screenshot, then `npm uninstall --no-save playwright-core` and delete the
  driver. Never leave `playwright-core` in `package.json`/the lockfile.

---

### Task 1: Hero tiles

**Files:**
- Modify: `src/renderer/dashboard/panels/heroTiles.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Test: `test/heroTilesMarkup.test.js` (new)

**Interfaces:**
- Consumes: `state.heroTiles` (`{ burnRate, spend, spendTokens, cacheHitRate, oneShotRate }`),
  `state.heroDeltas` (`{ burn, spend, cacheHit, oneShot }`, each `{ dir, good, text }` or absent) —
  unchanged, already produced by `buildDashboardState`.
- Produces: nothing new consumed by later tasks — hero tiles are a leaf panel.

**Current state:** `heroTiles.js` is 23 lines, 2 inline `style=` (`color:var(--acc)` on the burn
tile's value, `color:var(--acc2)` on the cache-hit tile's sub). `.hero-grid` in `dashboard.css` is
already `grid-template-columns: repeat(4, 1fr)` — this is *already* the prototype's "instruments off"
4x1 layout (`html[data-inst="off"] .hero-grid{grid-template-columns:repeat(4,1fr);grid-template-rows:1fr}`),
so no grid change is needed here; it happens to already be correct because instruments were never
built.

**Prototype reference** (`docs/prototype/index.html:399-417`, verbatim):

```css
.tile{
  background:var(--panel-grad);border:1px solid var(--panel-bd);border-radius:var(--r-panel);
  padding:13px 15px;display:flex;flex-direction:column;justify-content:center;min-width:0;
  box-shadow:0 1px 0 var(--acc-wash) inset, 0 10px 26px rgba(0,0,0,.26);position:relative;overflow:hidden;
}
.tile::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(180deg,transparent,var(--acc),transparent);opacity:.5}
.tile-top{display:flex;align-items:center;gap:7px;margin-bottom:8px}
.tile-label{font:600 9px/1 var(--f-ui);letter-spacing:2px;color:var(--tx-muted);flex:1;text-transform:uppercase}
.tile-value{font:700 27px/1 var(--f-mono);color:var(--tx-primary);letter-spacing:-.5px}
.tile-value .u{font-size:14px;color:var(--tx-secondary);margin-left:2px}
.tile-sub{font:400 9.5px/1 var(--f-mono);color:var(--tx-dim);margin-top:7px}
.delta{font:700 9px/1 var(--f-mono);padding:3px 6px;border-radius:5px;background:var(--panel-inset);border:1px solid var(--chip-bd)}
.delta.good{color:var(--success)} .delta.bad{color:var(--danger)}
```

Per the Global Constraints, skip the `background`/`border`/`border-radius`/`box-shadow`/`padding` line
(already on `.hero-tile` from Task 7) — port everything else: the `::before` accent bar, and the
label/value/sub/delta typography.

- [ ] **Step 1: Write the failing structural test**

```js
// test/heroTilesMarkup.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('heroTiles.js has no inline color styles - colors come from CSS classes', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'heroTiles.js'), 'utf8');
  assert.ok(!/style="color:/.test(src), 'found an inline color style - move it to a CSS class (e.g. .hero-value.accent, .hero-sub.good)');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/heroTilesMarkup.test.js`
Expected: FAIL — `heroTiles.js` currently has `style="color:var(--acc)"` and `style="color:var(--acc2)"`.

- [ ] **Step 3: Update `dashboard.css`'s hero-tile typography**

Replace the existing four rules with (keep `.hero-tile` and `.hero-delta`/`.hero-delta.good`/
`.hero-delta.bad` — those don't change; this only touches label/value/sub and adds the accent bar and
two new modifier classes to replace the inline colors):

```css
.hero-tile { background: var(--panel-grad); border: 1px solid var(--panel-bd); border-radius: var(--r-panel); box-shadow: 0 1px 0 var(--acc-wash) inset, 0 10px 30px rgba(0, 0, 0, .28); padding: 15px 17px; position: relative; overflow: hidden; }
.hero-tile::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: linear-gradient(180deg, transparent, var(--acc), transparent); opacity: .5; }
.hero-label { font: 600 9px/1 var(--f-ui); letter-spacing: 2px; color: var(--tx-muted); text-transform: uppercase; }
.hero-value { font: 700 27px/1.1 var(--f-mono); color: var(--tx-primary); letter-spacing: -.5px; }
.hero-value.accent { color: var(--acc); }
.hero-sub { font: 400 9.5px/1 var(--f-mono); color: var(--tx-dim); margin-top: 7px; }
.hero-sub.good { color: var(--success); }
```

`.hero-tile { position: relative; overflow: hidden; }` is new — required for the `::before` accent
bar to clip correctly inside the rounded corners.

- [ ] **Step 4: Update `heroTiles.js` to use the new classes instead of inline styles**

```js
// src/renderer/dashboard/panels/heroTiles.js
(function () {
  const WOW_NOTE = 'vs. your weekly average';

  function badge(d) {
    if (!d) return '';
    const arrow = d.dir === 'up' ? '▲ ' : '▼ ';
    return `<span class="hero-delta ${d.good ? 'good' : 'bad'}" title="${WOW_NOTE}">${arrow}${escapeHtml(d.text)}</span>`;
  }

  function render(state) {
    const el = document.getElementById('hero-grid');
    const { heroTiles } = state;
    const d = state.heroDeltas || {};
    el.innerHTML = `
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">Burn now</div>${badge(d.burn)}</div><div class="hero-value accent">${formatTokens(heroTiles.burnRate)}</div><div class="hero-sub">tokens / min</div></div>
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">Spend</div>${badge(d.spend)}</div><div class="hero-value">$${heroTiles.spend.toFixed(2)}</div><div class="hero-sub">${formatTokens(heroTiles.spendTokens)} tokens</div></div>
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">Cache hit</div>${badge(d.cacheHit)}</div><div class="hero-value">${Math.round(heroTiles.cacheHitRate * 100)}%</div><div class="hero-sub good">healthy</div></div>
    <div class="hero-tile"><div class="hero-tile-top"><div class="hero-label">1-shot rate</div>${badge(d.oneShot)}</div><div class="hero-value">${heroTiles.oneShotRate == null ? '--' : Math.round(heroTiles.oneShotRate * 100) + '%'}</div><div class="hero-sub">coding turns</div></div>
  `;
  }
  window.TT.heroTiles = { render };
})();
```

- [ ] **Step 5: Run the test again and confirm it passes**

Run: `node --test test/heroTilesMarkup.test.js`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions in `test/contrast.test.js` or `test/tokens.test.js` (this task adds
no new tokens, only consumes existing ones).

- [ ] **Step 7: Verify live, across two palettes**

Using the live-verification pattern from Global Constraints: launch the app, screenshot the default
hero grid on steel/dark, then set `document.documentElement.dataset.pal='midnight'` and screenshot
again. Confirm: four tiles render, burn tile's value is accent-colored, cache-hit tile's sub is
green, the thin left accent bar is visible on each tile, delta badges (when present) still show
green/red. Compare against the Task 7 screenshots (`shots7/01-steel-dark.png` etc. from the prior
session) for "nothing else moved."

- [ ] **Step 8: Commit**

```bash
git add src/renderer/dashboard/panels/heroTiles.js src/renderer/dashboard/dashboard.css test/heroTilesMarkup.test.js
git commit -m "feat(reskin): hero tiles typography and accent bar (Phase 5 slice 1)"
```

---

### Task 2: Budgets, and the `--alarm` unification

**Files:**
- Modify: `src/renderer/dashboard/panels/budgets.js`
- Modify: `src/renderer/dashboard/panels/miniMode.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Test: `test/budgetAlarmUnification.test.js` (new)

**Interfaces:**
- Consumes: `state.budgetVsQuota` (unchanged), **`state.alerts`** (already produced by
  `evaluateAlerts` in `src/shared/alertEngine.js` — each budget-window alert has `id: 'budget-<window>'`
  and `severity: 'warning' | 'critical'`; verified in `src/shared/alertEngine.js:15-34`. Absent = that
  window is not alarmed. This is the "existing tier output" the design spec's slice 2 says to drive
  the cascade from.).
- Produces: a shared `budgetTier(state, period)` helper (new, in `budgets.js`, exported on
  `window.TT.budgetsPanel` as `.tierFor` so `miniMode.js` can reuse it without duplicating the lookup)
  returning `'critical' | 'warning' | null`.

**The behavior change, stated explicitly:** today, `budgets.js` and `miniMode.js` independently
compute `pct >= 78` to decide whether a bar renders amber. `alertsConfig.js`'s default `thBudget` is
`80` (two points off `78` — the near-identical default is coincidental, not enforced) and is
user-adjustable via the Settings "Budget alert at" stepper (`50-100` range). After this task, a bar's
color is driven by whether `state.alerts` actually contains a `budget-<period>` entry — which respects
the user's configured threshold, **and respects `alertsEnabled`**: if a user has turned alerts off
entirely (`alertsConfig.enabled === false`), `evaluateAlerts` returns `[]` unconditionally, so **budget
bars will no longer show amber/red at all while alerts are disabled.** This is the intended
consequence of "one tier system, not three" — flag it in the commit message, don't silently absorb it.

**Prototype reference** (`docs/prototype/index.html:422-431`, verbatim — the `.bar-row`/`.track`/
`.fill` family, reused by both this panel and the "What tokens went to" panel in Task 3):

```css
.bar-row{display:flex;align-items:center;gap:12px;margin-top:9px}
.bar-label{width:62px;flex:none;font:600 10px/1 var(--f-ui);letter-spacing:1.5px;color:var(--tx-muted);text-transform:uppercase}
.track{flex:1;height:11px;border-radius:6px;background:var(--panel-inset);border:1px solid var(--chrome-bd);overflow:hidden}
.fill{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--acc-deep),var(--acc));box-shadow:0 0 12px var(--acc-glow);transition:width .5s ease,background .3s}
.fill.warn{background:linear-gradient(90deg,var(--warn),var(--warn));box-shadow:0 0 12px var(--warn)}
.fill.crit{background:linear-gradient(90deg,var(--danger),var(--danger));box-shadow:0 0 14px var(--danger)}
.bar-val{width:104px;flex:none;text-align:right;font:400 10.5px/1 var(--f-mono);color:var(--tx-secondary)}
.bar-val b{color:var(--tx-primary);font-weight:700}
```

Our current `.budget-fill.warn` only has one tier (amber); the prototype has two (`warn`/`crit`). This
task adds the `crit` tier, using the real severity from `state.alerts` rather than inventing a second
hardcoded percentage.

- [ ] **Step 1: Write the failing test — no hardcoded 78, and the tier helper exists**

```js
// test/budgetAlarmUnification.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('budgets.js no longer hardcodes the 78% warn threshold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'budgets.js'), 'utf8');
  assert.ok(!/>=\s*78/.test(src), 'budgets.js still has a hardcoded 78% threshold - drive it from state.alerts instead');
});

test('miniMode.js no longer hardcodes the 78% warn threshold', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'miniMode.js'), 'utf8');
  assert.ok(!/>=\s*78/.test(src), 'miniMode.js still has a hardcoded 78% threshold - drive it from state.alerts instead');
});
```

- [ ] **Step 2: Run it and confirm both fail**

Run: `node --test test/budgetAlarmUnification.test.js`
Expected: FAIL — `budgets.js:7` and `budgets.js:42` each have `>= 78`; `miniMode.js:22` has `>= 78`.

- [ ] **Step 3: Add the tier helper and rewrite `budgets.js`'s two call sites**

```js
// src/renderer/dashboard/panels/budgets.js
(function () {
  let syncState = 'idle'; // idle | syncing | failed

  // Single source of truth for "is this budget window alarmed" - looks up the
  // alertEngine's own budget-<period> alert rather than re-deciding with a
  // second hardcoded threshold. Absent = not alarmed (below the user's
  // configured thBudget, or alerts are disabled entirely).
  function tierFor(state, period) {
    const alert = (state.alerts || []).find((a) => a.id === `budget-${period}`);
    return alert ? alert.severity : null;
  }

  function fillClass(tier) {
    if (tier === 'critical') return ' crit';
    if (tier === 'warning') return ' warn';
    return '';
  }

  function planBar(label, pct) {
    const p = Math.min(100, Math.max(0, Math.round(pct)));
    return `
      <div class="budget-row">
        <div class="budget-label">${label}</div>
        <div class="budget-track"><div class="budget-fill" style="width:${p}%"></div></div>
        <div class="budget-remaining">${p}%</div>
      </div>`;
  }

  function planSection(state) {
    const pu = state.planUsage;
    const syncBtn = `<button type="button" id="plan-sync-btn" class="plan-sync-btn"${syncState === 'syncing' ? ' disabled' : ''}>${syncState === 'syncing' ? 'Syncing...' : 'Sync'}</button>`;
    if (!pu) {
      return `
        <div class="plan-usage-head"><span class="hero-label">Plan usage</span>${syncBtn}</div>
        <div class="plan-usage-hint">plan unknown - press Sync or run /usage in the terminal${syncState === 'failed' ? ' · last sync failed' : ''}</div>
        <div class="plan-divider"></div>`;
    }
    const tierLabel = pu.tier === 'max' ? 'Max' : pu.tier === 'pro' ? 'Pro' : '?';
    const age = pu.ageMinutes <= 0 ? 'just now' : `${pu.ageMinutes}m ago`;
    return `
      <div class="plan-usage-head"><span class="hero-label">Plan usage · ${tierLabel}</span>${syncBtn}</div>
      ${planBar('Session (5h)', pu.session.pct)}
      ${planBar('Week', pu.week.pct)}
      ${pu.weekModel ? planBar('Week (model)', pu.weekModel.pct) : ''}
      <div class="plan-usage-meta">resets ${escapeHtml(pu.week.resetsAt)} · as of ${age}${syncState === 'failed' ? ' · last sync failed' : ''}</div>
      <div class="plan-divider"></div>`;
  }

  function render(state) {
    const el = document.getElementById('budget-panel');
    const rows = ['session', 'day', 'week', 'month']
      .map((period) => {
        const { used, limit } = state.budgetVsQuota[period];
        const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
        return `
        <div class="budget-row">
          <div class="budget-label">${period[0].toUpperCase()}${period.slice(1)}</div>
          <div class="budget-track"><div class="budget-fill${fillClass(tierFor(state, period))}" style="width:${pct}%"></div></div>
          <div class="budget-remaining">${Math.round(pct)}% . ${formatTokens(Math.max(0, limit - used))}</div>
        </div>`;
      })
      .join('');
    el.innerHTML = `${planSection(state)}<div class="hero-label">Budget vs. quota</div>${rows}`;

    const btn = document.getElementById('plan-sync-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (syncState === 'syncing') return;
        syncState = 'syncing';
        btn.disabled = true;
        btn.textContent = 'Syncing...';
        try {
          const res = await window.tokenTracker.plan.sync();
          syncState = res && res.ok ? 'idle' : 'failed';
        } catch (err) {
          syncState = 'failed';
        }
        // next 1s push re-renders with fresh planUsage/ageMinutes
      });
    }
  }
  window.TT.budgetsPanel = { render, tierFor };
})();
```

`planBar` (the plan-usage bars) intentionally keeps no warn/crit tier here - it never had one before
this task (no `warn` variable existed in `planBar`), and `state.alerts`'s `plan-week` entry already
covers plan-usage alarming separately (`alertEngine.js:82-95`). Don't invent a new tier for it; that's
scope this task doesn't need.

- [ ] **Step 4: Update `miniMode.js` to use the same helper**

```js
// src/renderer/dashboard/panels/miniMode.js, inside render(state)'s `bars` map - replace:
//   return `
//     <div class="mini-bar-row">
//       <span class="mini-bar-label">${period[0].toUpperCase()}${period.slice(1)}</span>
//       <div class="mini-track"><div class="mini-fill${pct >= 78 ? ' warn' : ''}" style="width:${pct}%"></div></div>
//       <span class="mini-bar-pct">${Math.round(pct)}%</span>
//     </div>`;
// with:
        const tier = window.TT.budgetsPanel.tierFor(state, period);
        return `
        <div class="mini-bar-row">
          <span class="mini-bar-label">${period[0].toUpperCase()}${period.slice(1)}</span>
          <div class="mini-track"><div class="mini-fill${tier === 'critical' ? ' crit' : tier === 'warning' ? ' warn' : ''}" style="width:${pct}%"></div></div>
          <span class="mini-bar-pct">${Math.round(pct)}%</span>
        </div>`;
```

`mini-fill.crit` doesn't exist in `dashboard.css` yet — add it next to the existing `.mini-fill.warn`
rule: `.mini-fill.crit { background: var(--danger); }`.

`miniMode.js` loads after `budgetsPanel` in `index.html`'s script list (`budgets.js` is line ~182,
`miniMode.js` is line ~195 - already in the right order; verify with
`grep -n 'budgets.js\|miniMode.js' src/renderer/index.html` before assuming, in case Task 8/7 moved
something), so `window.TT.budgetsPanel.tierFor` is always defined by the time `miniMode.js`'s `render`
runs.

- [ ] **Step 5: Update `dashboard.css`'s budget-fill rules**

```css
.budget-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--acc-deep), var(--acc)); box-shadow: 0 0 12px var(--acc-glow); transition: width .5s ease, background .3s; }
.budget-fill.warn { background: var(--warn); box-shadow: 0 0 12px var(--warn); }
.budget-fill.crit { background: var(--danger); box-shadow: 0 0 14px var(--danger); }
.budget-track { flex: 1; height: 11px; background: var(--panel-inset); border: 1px solid var(--chrome-bd); border-radius: 6px; overflow: hidden; }
.budget-label { width: 64px; font: 600 10px/1 var(--f-ui); letter-spacing: 1.5px; color: var(--tx-muted); text-transform: uppercase; }
.budget-remaining { width: 96px; text-align: right; font: 400 10.5px/1 var(--f-mono); color: var(--tx-secondary); }
```

- [ ] **Step 6: Run the tests again and confirm both pass**

Run: `node --test test/budgetAlarmUnification.test.js`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 8: Verify live - all three tiers, and the disabled-alerts consequence**

Using the live-verification pattern: launch the app, set a budget config so session usage sits above
`thBudget` (e.g. `window.tokenTracker.budget.set({ session: { tokens: 1000 } })` against real live
usage, or lower `thBudget` via `window.tokenTracker.alerts.set({ thBudget: 1 })` to force every window
into `warning`/`critical`) and screenshot the amber/red bars. Then set
`window.tokenTracker.alerts.set({ enabled: false })` and confirm the bars go back to the neutral
accent gradient even though usage is still high - this is the documented behavior change from this
task, verify it's real, not just asserted.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/dashboard/panels/budgets.js src/renderer/dashboard/panels/miniMode.js src/renderer/dashboard/dashboard.css test/budgetAlarmUnification.test.js
git commit -m "feat(reskin): unify the 78% warn threshold into alertEngine's tier output (Phase 5 slice 2)"
```

---

### Task 3: Agents lanes, task breakdown, and treemap

**Files:**
- Modify: `src/renderer/dashboard/panels/activity.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Test: `test/activityMarkup.test.js` (new)

**Interfaces:**
- Consumes: `state.runningAgents`, `state.taskBreakdown` — unchanged.
- Produces: nothing new.

**Scope note, stated explicitly:** the design spec's slice 3 row only names "Agents lanes + treemap,"
but `activity.js` is one 66-line file rendering **three** panels — `#agents-panel`, `#task-panel` and
`#treemap-panel` — confirmed by `grep -n getElementById src/renderer/dashboard/panels/activity.js`.
The task breakdown panel isn't named in any slice row in the design spec at all. Since all three are
one file and one reviewable unit, this task covers all three rather than artificially splitting a
66-line file across tasks the design doc didn't actually separate.

**Also excluded, per Global Constraints' "no instruments" rule:** the prototype's "Concurrent
sessions" panel includes a canvas orchestration graph (`#ograph`, toggled by `data-agents="grid"` vs
`"lanes"`) and its "What tokens went to" panel includes a canvas donut chart (`#donut`) plus model-split
chips (`.mchip`). Neither has an equivalent in our current `activity.js` — building them is new
visualization work, the same category of exclusion as the deferred instruments. This task ports only
the lane-bar and bar-row typography/color language, not the canvas widgets.

**Prototype reference** (`docs/prototype/index.html:432-445`, lanes; `:339-345`, shared `.panel-head`/
`.panel-title` also used by every panel in this task):

```css
.lane{display:flex;align-items:center;gap:12px;margin-top:9px}
.lane-name{width:104px;flex:none;font:400 10.5px/1 var(--f-mono);color:var(--tx-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lane-track{flex:1;height:16px;border-radius:6px;background:var(--panel-inset);border:1px solid var(--chrome-bd);position:relative;overflow:hidden}
.lane-bar{position:absolute;top:0;bottom:0;border-radius:5px;background:linear-gradient(90deg,var(--acc-wash),var(--acc-wash))}
.lane-bar.active{background:repeating-linear-gradient(90deg,var(--alarm),var(--alarm) 7px,transparent 7px,transparent 13px);animation:flow 1.1s linear infinite}
.lane-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--tx-dim)}
.lane-dot.on{background:var(--success);box-shadow:0 0 8px var(--success)}
```

Our current `.agent-lane`/`.agent-label`/`.agent-track`/`.agent-bar` markup has no dot and no
name-width constraint; this task adds both to match the prototype's structure, and swaps the active
stripe's color from `--acc2` (current) to `--alarm` per the prototype's literal declaration (`--alarm`
defaults to `--success` - green - at `:root`, so this reads as "healthy and active," consistent with
what a running lane means; it does not turn red, since `--alarm` isn't wired to alert severity by any
task in this plan).

The `.bar-row`/`.bar-label`/`.track`/`.fill`/`.bar-val` family is shared with Task 2 (`.budget-row`
etc. are our own class names carrying the same declarations already). Task breakdown's rows
(`.task-row`/`.task-label`/`.task-track`/`.task-fill`) get the same typography treatment as
`.budget-row` for consistency, since the prototype literally reuses one `.bar-row` class for both.

**Treemap reference** (`docs/prototype/index.html:472-478`):

```css
.treemap{display:flex;gap:5px;height:70px;margin-top:4px}
.tm{display:flex;flex-direction:column;justify-content:flex-end;min-width:8px;border-radius:8px;padding:8px 10px;overflow:hidden;transition:transform .18s}
.tm:hover{transform:translateY(-2px)}
.tm-cat{font:700 10px/1 var(--f-ui);letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-pct{font:400 9px/1 var(--f-mono);opacity:.75;margin-top:3px}
```

- [ ] **Step 1: Write the failing structural test**

```js
// test/activityMarkup.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('activity.js renders a lane-dot per agent lane', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'activity.js'), 'utf8');
  assert.ok(src.includes('agent-dot'), 'renderAgents should render a status dot per lane, matching the prototype .lane-dot');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/activityMarkup.test.js`
Expected: FAIL — no `agent-dot` anywhere in the current file.

- [ ] **Step 3: Rewrite `activity.js`'s three render functions**

```js
// src/renderer/dashboard/panels/activity.js
(function () {
  function renderAgents(state) {
    const el = document.getElementById('agents-panel');
    const agents = state.runningAgents;
    const rows = agents
      .map(
        (agent) => `
      <div class="agent-lane">
        <span class="agent-dot on"></span>
        <div class="agent-label">${escapeHtml(agent.subagentType || 'agent')}</div>
        <div class="agent-track"><div class="agent-bar active" style="width:100%"></div></div>
      </div>`
      )
      .join('');
    el.innerHTML = `<div class="hero-label">${agents.length} active</div>${rows || '<div class="agent-label">none running</div>'}`;
  }

  function renderTaskBreakdown(state) {
    const el = document.getElementById('task-panel');
    const breakdown = state.taskBreakdown;
    const maxTokens = Math.max(1, ...breakdown.map((b) => b.tokens));
    const rows = breakdown
      .map(
        (b) => `
      <div class="task-row">
        <div class="task-label">${b.category}</div>
        <div class="task-track"><div class="task-fill" style="width:${(b.tokens / maxTokens) * 100}%"></div></div>
        <div class="budget-remaining">${formatTokens(b.tokens)}</div>
      </div>`
      )
      .join('');
    el.innerHTML = `<div class="hero-label">What agents worked on</div>${rows}`;
  }

  function renderTreemap(state) {
    const el = document.getElementById('treemap-panel');
    if (!el) return;
    const breakdown = state.taskBreakdown || [];
    const total = breakdown.reduce((s, b) => s + (b.tokens || 0), 0);
    const header = `<div class="hero-label">Token treemap</div>`;
    if (!breakdown.length || total <= 0) {
      el.innerHTML = `${header}<div class="treemap-empty">no activity yet.</div>`;
      return;
    }
    const colors = ['var(--acc)', 'var(--acc-deep)', 'var(--warn)', 'var(--panel-inset)', 'var(--tx-dim)'];
    const blocks = breakdown
      .map((b, i) => {
        const tokens = b.tokens || 0;
        const pct = Math.round((tokens / total) * 100);
        const wide = tokens / total >= 0.08;
        return `
      <div class="treemap-block" style="flex:${tokens} 1 0;background:${colors[i % colors.length]}" title="${escapeHtml(b.category)} ${pct}%">
        ${wide ? `<div class="treemap-cat">${escapeHtml(b.category)}</div><div class="treemap-pct">${pct}%</div>` : ''}
      </div>`;
      })
      .join('');
    el.innerHTML = `${header}<div class="treemap-row">${blocks}</div>`;
  }

  function render(state) {
    renderAgents(state);
    renderTaskBreakdown(state);
    renderTreemap(state);
  }
  window.TT.activity = { render };
})();
```

- [ ] **Step 4: Update `dashboard.css`**

```css
.agent-lane { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
.agent-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; background: var(--tx-dim); }
.agent-dot.on { background: var(--success); box-shadow: 0 0 8px var(--success); }
.agent-label { width: 96px; font: 400 10.5px/1 var(--f-mono); color: var(--tx-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-track { position: relative; flex: 1; height: 16px; background: var(--panel-inset); border: 1px solid var(--chrome-bd); border-radius: 6px; overflow: hidden; }
.agent-bar { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; background: linear-gradient(90deg, var(--acc-wash), var(--acc-wash)); }
.agent-bar.active { background: repeating-linear-gradient(90deg, var(--alarm), var(--alarm) 7px, transparent 7px, transparent 13px); animation: flow 1.1s linear infinite; }

.task-label { width: 88px; font: 600 10px/1 var(--f-ui); letter-spacing: 1.5px; color: var(--tx-muted); text-transform: uppercase; }
.task-track { flex: 1; height: 9px; background: var(--panel-inset); border: 1px solid var(--chrome-bd); border-radius: 5px; overflow: hidden; }
.task-fill { height: 100%; background: linear-gradient(90deg, var(--acc-deep), var(--acc)); box-shadow: 0 0 12px var(--acc-glow); }

.treemap-block { display: flex; flex-direction: column; justify-content: flex-end; min-width: 8px; border-radius: 8px; padding: 8px 10px; overflow: hidden; transition: transform .18s; }
.treemap-block:hover { transform: translateY(-2px); }
.treemap-cat { font: 700 10px/1 var(--f-ui); letter-spacing: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.treemap-pct { font: 400 9px/1 var(--f-mono); opacity: .75; margin-top: 3px; }
```

`--tx-body` is one of the 34 tokens already verified present in every palette (reskin-phases-3-4 §7).
`@keyframes flow` already exists (`dashboard.css:9`) and is reused unchanged, per the design spec's
explicit note that this slice retints rather than rewrites it.

- [ ] **Step 5: Run the test again and confirm it passes**

Run: `node --test test/activityMarkup.test.js`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `npm test`

- [ ] **Step 7: Verify live**

Launch the app; if no agents are currently running, `#agents-panel` will render "0 active" with no
lane rows - that's an existing, correct empty state, not a bug in this task. Confirm the task
breakdown and treemap render with the new typography and that treemap blocks still size proportionally
(the `style="flex:..."` inline value is genuinely runtime data - it must stay inline per Global
Constraints).

- [ ] **Step 8: Commit**

```bash
git add src/renderer/dashboard/panels/activity.js src/renderer/dashboard/dashboard.css test/activityMarkup.test.js
git commit -m "feat(reskin): agent lanes, task breakdown and treemap typography (Phase 5 slice 3)"
```

---

### Task 4: Alerts banner and CLI toast

**Files:**
- Modify: `src/renderer/dashboard/dashboard.css`
- Test: `test/alertsMarkup.test.js` (new)

**Interfaces:**
- Consumes: `state.alerts` (unchanged).
- Produces: nothing new.

**No JS changes in this task.** `src/renderer/dashboard/panels/alerts.js` already has zero inline
styles (verified: `grep -o 'style=' src/renderer/dashboard/panels/alerts.js` returns nothing) and its
markup structure (multi-row banner, expandable fix panel, per-row dismiss, chips, a separate CLI
toast) has **no prototype equivalent** — the prototype's `.alert` is a single, non-dismissible,
non-expandable bar (`docs/prototype/index.html:349-361`). This task adopts the prototype's *visual
language* (the alarm-tinted left border, glyph, title/sub typography) onto our richer existing
structure; it does not attempt to replace the structure, since there's nothing in the prototype to
replace it with.

**Prototype reference** (`docs/prototype/index.html:349-361`):

```css
.alert{
  display:none;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;
  background:var(--panel-grad);border:1px solid var(--panel-bd);border-left:3px solid var(--alarm);
  box-shadow:0 0 24px -8px var(--alarm-glow);animation:bannerIn .25s ease;
}
.alert-glyph{font-size:16px;color:var(--alarm);line-height:1}
.alert-title{font:700 12px/1.3 var(--f-ui);letter-spacing:.6px;color:var(--tx-primary)}
.alert-sub{font:400 10px/1.5 var(--f-mono);color:var(--tx-secondary);margin-top:3px}
```

Our `.alert-row` has two real severities (`.warning`/`.critical`); the prototype's single `.alert` has
one (`--alarm`). Map `.alert-row.critical` to `--danger` (already correct in our CSS - it currently
uses `var(--warn)`, which is a **pre-existing bug this task also fixes**: `.alert-row.critical` and
`.alert-row.warning` currently resolve to the identical color, `var(--warn)` - verified at
`dashboard.css:220`) and `.alert-row.warning` to `--warn`, each with the prototype's border-radius/
box-shadow/animation treatment layered on.

- [ ] **Step 1: Write the failing test — critical and warning must be visually distinct**

```js
// test/alertsMarkup.test.js
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/alertsMarkup.test.js`
Expected: FAIL — `.alert-row.critical` currently has no `--danger` reference (it uses `--warn`, same
as `.alert-row.warning`).

- [ ] **Step 3: Rewrite the alert rules in `dashboard.css`**

Replace the existing `/* Alert banner */` block (`dashboard.css:213-230` in the pre-Phase-5 file —
line numbers will have shifted after Tasks 1-3; find it by the `#alerts-banner` selector) with:

```css
/* Alert banner */
#alerts-banner { display: flex; flex-direction: column; gap: 9px; margin: 22px 24px 0; }
#alerts-banner:empty { display: none; }
.alert-unit { display: flex; flex-direction: column; }
.alert-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--panel-grad); border: 1px solid var(--panel-bd); animation: bannerIn .25s ease; }
.alert-row.warning { border-left: 3px solid var(--warn); box-shadow: 0 0 24px -8px var(--warn); }
.alert-row.warning .alert-icon, .alert-row.warning .alert-title { color: var(--warn); }
.alert-row.warning .alert-title { color: var(--tx-primary); }
.alert-row.critical { border-left: 3px solid var(--danger); box-shadow: 0 0 24px -8px var(--danger); }
.alert-row.critical .alert-icon { color: var(--danger); }
.alert-row.open { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.alert-icon { font-size: 16px; line-height: 1; }
.alert-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.alert-title { font: 700 12px/1.3 var(--f-ui); letter-spacing: .6px; color: var(--tx-primary); }
.alert-detail { font: 400 10px/1.5 var(--f-mono); color: var(--tx-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alert-fix-btn { font: 600 10px/1 var(--f-ui); letter-spacing: .8px; border-radius: var(--r-chip); padding: 8px 12px; cursor: pointer; background: var(--acc-wash); border: 1px solid var(--active-bd); color: var(--tx-primary); white-space: nowrap; }
.alert-fix-btn:hover { border-color: var(--acc); }
.alert-dismiss { background: transparent; border: none; font-size: 15px; line-height: 1; cursor: pointer; color: var(--dim); }
```

`@keyframes bannerIn` doesn't exist yet in `dashboard.css` - add it next to the existing
`@keyframes blink`/`@keyframes pulse`/`@keyframes flow` block, copied verbatim from the prototype
(`docs/prototype/index.html:238`): `@keyframes bannerIn{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}`.

This drops the prior `.alert-row.critical { background: var(--warn); color: var(--bg); ... }`
full-background treatment in favor of the prototype's border-left-accent-on-panel-grad treatment,
matching how `.alert-row.warning` was already styled - so both severities now use the *same*
structural treatment (panel background + colored left border), differing only in the border/glow
color. Update the two rules that assumed a solid critical background:
`.alert-row.critical .alert-fix-btn` and `.alert-row.critical .alert-dismiss` (both currently override
colors *for* a solid-background critical row) - delete both; the base `.alert-fix-btn`/`.alert-dismiss`
rules already read correctly against the new panel-grad background for both severities.

- [ ] **Step 4: Update the CLI toast (`#cli-toast` and its children) to match**

```css
#cli-toast { position: absolute; left: 10px; right: 22px; bottom: 10px; z-index: 5; display: flex; align-items: center; gap: 9px; background: var(--panel-grad); border: 1px solid var(--panel-bd); border-left: 3px solid var(--alarm); border-radius: 12px; padding: 10px 12px; box-shadow: 0 0 24px -8px var(--alarm-glow); }
.cli-toast-icon { font-size: 14px; line-height: 1; color: var(--alarm); }
.cli-toast-title { font: 700 11px/1.3 var(--f-ui); color: var(--tx-primary); }
.cli-toast-detail { font: 400 9.5px/1.4 var(--f-mono); color: var(--tx-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cli-toast-dismiss { background: transparent; border: none; font-size: 14px; line-height: 1; cursor: pointer; color: var(--dim); }
```

`#cli-toast` keeps `--alarm` as its baseline accent (like the prototype's single `.alert`) rather than
gaining its own warning/critical split - it's a compact, single-line surface, and `alerts.js`'s
`renderToast` already picks the single most-severe active alert to show, so the color distinction
matters less here than in the multi-row banner where several severities can be visible at once. This
is a deliberate scope narrowing, not an oversight - if a future reviewer wants toast severity-tinting
too, that's a follow-up, not a defect in this task.

- [ ] **Step 5: Run the test again and confirm it passes**

Run: `node --test test/alertsMarkup.test.js`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `npm test`

- [ ] **Step 7: Verify live — force both severities**

Using the live-verification pattern: lower `thBudget`/`thBurn` via `window.tokenTracker.alerts.set(...)`
to force a `warning` alert, screenshot the banner; force a `critical` one (e.g. push a budget window
over 100% or set `thWaste` to 0 with an active optimize finding) and screenshot again. Confirm the two
are visually distinct (amber vs red left border and glow) - this was not true before this task (both
resolved to `--warn`). Also trigger the CLI toast (any active, non-dismissed alert makes it render)
and confirm it shows the panel-grad background with the alarm-colored left border, not the old flat
`--panel2` treatment.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/dashboard/dashboard.css test/alertsMarkup.test.js
git commit -m "fix(reskin): alert banner - distinguish critical from warning, adopt alarm-border language (Phase 5 slice 4)"
```

---

### Task 5: Optimize

**Files:**
- Modify: `src/renderer/dashboard/panels/optimize.js`
- Modify: `src/renderer/dashboard/dashboard.css`
- Test: `test/optimizeMarkup.test.js` (new)

**Interfaces:**
- Consumes: `state.optimizeFindings`, `state.optimizeSummary`, `state.optimizeBreakdown`,
  `state.optimizeApplied` — unchanged.
- Produces: nothing new.

**Current state:** `optimize.js` is 257 lines with exactly one inline style:
`style="border-left-color:${borders[i % borders.length]}"`, where
`borders = ['var(--acc)', 'var(--acc2)', 'var(--warn)']` - a purely decorative, index-based color
rotation with no connection to whether a finding is `recurring`. The prototype instead ties the left
border to `.recurring` as a real state (`docs/prototype/index.html:458-471`):

```css
.opt-card{background:var(--panel-inset);border:1px solid var(--chrome-bd);border-left:2px solid var(--acc);border-radius:var(--r-tile);padding:12px 13px;display:flex;flex-direction:column;gap:7px;min-width:0;transition:all .18s}
.opt-card:hover{border-color:var(--active-bd);border-left-color:var(--acc);transform:translateY(-1px)}
.opt-card.recurring{border-left-color:var(--warn)}
.opt-title{font:600 12px/1.3 var(--f-ui);letter-spacing:.4px;color:var(--tx-primary)}
.opt-detail{font:400 9.5px/1.5 var(--f-mono);color:var(--tx-muted);overflow-wrap:anywhere}
.opt-save{font:700 11px/1 var(--f-mono);color:var(--success)}
.opt-save.warnc{color:var(--warn)}
.opt-apply{align-self:flex-start;margin-top:2px;font:600 9.5px/1 var(--f-ui);letter-spacing:1.2px;color:var(--tx-primary);border:1px solid var(--active-bd);background:var(--acc-wash);border-radius:6px;padding:6px 10px;cursor:pointer;transition:all .15s}
.opt-apply:hover{border-color:var(--acc)}
.verified{font:600 9.5px/1 var(--f-ui);letter-spacing:1.2px;color:var(--success);padding:6px 0}
.grade{font:700 11px/1 var(--f-ui);letter-spacing:1.5px;color:#1a1204;background:var(--warn);border:none;border-radius:var(--r-chip);padding:6px 11px;cursor:pointer}
```

Adopting `.recurring` as a real CSS modifier (our `f.recurring` field already exists on each finding —
confirmed at `src/main/ipcHandlers.js`'s `optimizeFindings` mapping, `recurring: applied`) removes the
one inline style *and* makes the border meaningful instead of decorative. Per Global Constraints, the
panel-formula's `background`/`border`/`border-radius`/`box-shadow` on `.optimize-card` stays from
Task 7 - this task only changes `border-left-color` behavior and the typography.

- [ ] **Step 1: Write the failing test**

```js
// test/optimizeMarkup.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('optimize.js has no inline border-left-color - recurring findings use a CSS class instead', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'optimize.js'), 'utf8');
  assert.ok(!/style="border-left-color/.test(src), 'found the decorative border-left-color rotation - replace with the .recurring class, driven by the real f.recurring field');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/optimizeMarkup.test.js`
Expected: FAIL

- [ ] **Step 3: Find and update the card-rendering block**

```bash
grep -n "optimize-card\" style=" src/renderer/dashboard/panels/optimize.js
```

Replace:
```js
        <div class="optimize-card" style="border-left-color:${borders[i % borders.length]}">
```
with:
```js
        <div class="optimize-card${f.recurring ? ' recurring' : ''}">
```

Delete the now-unused `const borders = [...]` line a few lines above it (find via
`grep -n "const borders" src/renderer/dashboard/panels/optimize.js`) — leaving it in place would be
dead code once nothing reads it.

- [ ] **Step 4: Update `dashboard.css`**

```css
.optimize-card { background: var(--panel-grad); border: 1px solid var(--panel-bd); border-left: 2px solid var(--acc); border-radius: var(--r-panel); box-shadow: 0 1px 0 var(--acc-wash) inset, 0 10px 30px rgba(0, 0, 0, .28); padding: 11px 12px; display: flex; flex-direction: column; gap: 6px; transition: all .18s; }
.optimize-card:hover { border-color: var(--active-bd); transform: translateY(-1px); }
.optimize-card.recurring { border-left-color: var(--warn); }
.optimize-card-title { font: 600 12px/1.3 var(--f-ui); letter-spacing: .4px; color: var(--tx-primary); }
.optimize-card-detail { font: 400 9.5px/1.5 var(--f-mono); color: var(--tx-muted); overflow-wrap: anywhere; }
.optimize-card-save { font: 700 11px/1 var(--f-mono); color: var(--success); }
.optimize-apply { align-self: flex-start; margin-top: 2px; font: 600 9.5px/1 var(--f-ui); letter-spacing: 1.2px; color: var(--tx-primary); border: 1px solid var(--active-bd); background: var(--acc-wash); border-radius: 6px; padding: 6px 10px; cursor: pointer; transition: all .15s; }
.optimize-apply:hover { border-color: var(--acc); }
.optimize-recurring { font: 600 9.5px/1 var(--f-ui); letter-spacing: 1.2px; color: var(--warn); padding: 6px 0; }
.optimize-grade { font: 700 11px/1 var(--f-ui); letter-spacing: 1.5px; color: #1a1204; background: var(--warn); border: none; border-radius: var(--r-chip); padding: 6px 11px; cursor: pointer; }
.optimize-title { font: 700 9.5px 'JetBrains Mono', monospace; letter-spacing: .6px; color: var(--dim); text-transform: uppercase; }
```

Keep `.optimize-title` (the panel's own `#9889; Optimize - ...` header text) on its existing font -
it's `.panel-title`-equivalent, not `.opt-title` (the prototype's `.opt-title` is the per-card finding
title, which maps to our `.optimize-card-title`, already updated above). Don't conflate the two - this
is a common mistake when porting prototype class names 1:1; our panel already has its own
`.optimize-header`/`.optimize-title` for the panel chrome, distinct from each card's title.

- [ ] **Step 5: Run the test again and confirm it passes**

Run: `node --test test/optimizeMarkup.test.js`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `npm test`

- [ ] **Step 7: Verify live**

Launch the app; if there are active optimize findings, confirm at least one shows the accent-colored
left border and (if `recurring: true` on any finding) at least one shows the warn-colored border
instead of the old rotating-index colors. If there are currently no findings, temporarily lower a
threshold (e.g. via `window.tokenTracker.optimize.targets()` inspection, or just confirm the empty
state `.optimize-empty` still renders correctly - don't fabricate findings data to force this if the
live environment is genuinely clean; note in the verification log which case you hit).

- [ ] **Step 8: Commit**

```bash
git add src/renderer/dashboard/panels/optimize.js src/renderer/dashboard/dashboard.css test/optimizeMarkup.test.js
git commit -m "feat(reskin): optimize card typography, recurring border driven by real state (Phase 5 slice 5)"
```

---

## Definition of done (for these 5 slices)

- `npm test` green, including the five new test files this plan adds.
- `npm run probe` still reports `ok: true` for tokens/fonts/swatches/panels (this plan touches no
  tokens, so this is a regression check, not new coverage).
- Live-launched app, steel/dark and at least one legacy palette: hero tiles show the accent bar and
  colored value/sub; budget bars show three tiers (neutral/warn/crit) driven by real alert state, and
  visibly stop alarming when alerts are disabled; agent lanes show a status dot; alert banner rows are
  visibly distinct between warning and critical; optimize cards show accent or warn border based on
  `recurring`, never rotating.
- No new inline `style=` attributes beyond genuinely runtime-computed ones (bar/fill widths, treemap
  flex-basis) - re-run `test/inlineStyles.test.js`'s counting logic against each touched file's
  `style="` occurrences if unsure.
- `docs/follow-ups.md` gets one new entry (write it after Task 5, not before): the five slices this
  plan didn't cover (Insights, Settings-content, Onboarding, Fleet, Mini mode) need their own design
  pass before they can be planned - no prototype markup exists for any of them. Also note the alias
  deletion (design spec §9's "final slice") stays blocked until all ten are done.

## What this plan deliberately does not do

- **Insights, Settings-content, Onboarding, Fleet/Team, Mini mode.** No prototype markup exists for
  any of the five - see Global Constraints. Each needs its own short design pass (apply the same
  token/typography language this plan establishes, but the actual layout is new invention, not a
  port) before it can be planned with this level of concreteness.
- **The orchestration graph and donut chart canvases** the prototype's "Concurrent sessions" and
  "What tokens went to" panels include. New visualization components, same exclusion category as the
  deferred instruments.
- **Deleting the compatibility aliases** (design spec §9's final slice). Blocked until every panel
  stops referencing v1's `--bg`/`--panel`/`--tx`/`--dim` aliases, which won't be true until the five
  deferred slices above are also done.
- **A sparkline on the burn-now hero tile.** The prototype has one (`.spark`/`#spark`), but it needs
  a data source this plan didn't scope (a recent-points slice separate from `state.insights.series`,
  which is Insights-panel-owned data) and isn't required for the hero tile's typography/color port to
  be complete. Track as a follow-up alongside the deferred slices, not a gap in Task 1.
