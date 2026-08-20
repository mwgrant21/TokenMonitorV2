// src/renderer/dashboard/panels/onboarding.js
(function () {
  const root = () => document.getElementById('onboarding-root');

  const state = {
    open: false,
    step: 0,
    replay: false, // true when reopened from Settings; skip closes without writing
    monthly: 120_000_000,
    derived: null,
    alerts: { enabled: true, thBudget: 80, thBurn: 2, thWaste: 15, thAgent: 150 },
    teamChoice: 'skip', // 'connect' | 'skip'
    fleetFolder: null,
    error: null,
  };

  let thRanges = null;

  const STEP_LABELS = ['Welcome', 'Budget', 'Alerts', 'Appearance', 'Team reporting', 'All set'];

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(n);
  }

  function dots() {
    return `<div class="ob-dots">${STEP_LABELS.map((_, i) =>
      `<span class="ob-dot${i < state.step ? ' done' : ''}${i === state.step ? ' active' : ''}"></span>`).join('')}</div>`;
  }

  function stepBody() {
    switch (state.step) {
      case 0:
        return `<div class="ob-title">Welcome to Token Tracker</div>
          <div class="ob-body">Your Claude Code usage, live, beside your terminal.</div>
          <div class="ob-value-props">
            <div class="ob-prop">Budgets and burn rate at a glance</div>
            <div class="ob-prop">See what your agents are working on</div>
            <div class="ob-prop">Alerts and one-click waste fixes</div>
          </div>`;
      case 1:
        return `<div class="ob-title">Monthly token budget</div>
          <div class="ob-body">Session, day and week targets derive automatically. Adjust any of them later in Settings.</div>
          <div class="ob-stepper">
            <button type="button" class="ob-step-btn" id="ob-monthly-minus">&#8722;</button>
            <div class="ob-stepper-value" id="ob-monthly-value">${fmt(state.monthly)}</div>
            <button type="button" class="ob-step-btn" id="ob-monthly-plus">&#43;</button>
            <span class="ob-body">tokens / month</span>
          </div>
          <div class="ob-derived" id="ob-derived"></div>`;
      case 2:
        return `<div class="ob-title">Alerts</div>
          <div class="ob-row"><span>Enable alerts</span>
            <input type="checkbox" id="ob-alerts-enabled"${state.alerts.enabled ? ' checked' : ''}></div>
          ${[
            ['thBudget', 'Budget alert at', '%'],
            ['thBurn', 'Burn spike >=', 'x'],
            ['thWaste', 'Waste alert >=', '$'],
            ['thAgent', 'Agent ceiling', 'k tokens'],
          ].map(([key, label, unit]) => `
          <div class="ob-row"><span>${label}</span>
            <span class="ob-stepper" style="margin:0">
              <button type="button" class="ob-step-btn ob-th" data-key="${key}" data-dir="-1">&#8722;</button>
              <span class="ob-stepper-value" style="min-width:56px" id="ob-${key}">${state.alerts[key]}</span>
              <button type="button" class="ob-step-btn ob-th" data-key="${key}" data-dir="1">&#43;</button>
              <span class="ob-body">${unit}</span>
            </span></div>`).join('')}`;
      case 3:
        return `<div class="ob-title">Appearance</div>
          <div class="ob-body">Pick a theme - it applies live. Change it anytime from Settings.</div>
          <div id="ob-swatch-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px"></div>`;
      case 4:
        return `<div class="ob-title">Team reporting</div>
          <div class="ob-body">Optionally share usage totals (never prompt content) to a team folder.</div>
          <div class="ob-option${state.teamChoice === 'connect' ? ' selected' : ''}" id="ob-team-connect">
            <b>Connect now</b><div class="ob-body">${esc(state.fleetFolder || 'pick the shared folder, e.g. \\\\shared\\claude-usage')}</div></div>
          <div class="ob-option${state.teamChoice === 'skip' ? ' selected' : ''}" id="ob-team-skip">
            <b>Skip for now</b><div class="ob-body">You can connect later from the Team view.</div></div>`;
      case 5:
        return `<div class="ob-title">All set</div>
          <div class="ob-body">Monthly budget: <b>${fmt(state.monthly)}</b> tokens.
          Alerts ${state.alerts.enabled ? 'on' : 'off'}. Theme applied.
          ${state.teamChoice === 'connect' && state.fleetFolder ? 'Team reporting connected.' : 'Team reporting skipped.'}</div>`;
      default:
        return '';
    }
  }

  function footButtons() {
    const primary = state.step === 5 ? 'Open dashboard' : state.step === 4 ? 'Finish' : 'Next';
    return `<div class="ob-foot">
      <span>${state.step === 0
        ? `<button type="button" class="ob-btn ghost" id="ob-skip">${state.replay ? 'Cancel' : 'Skip setup'}</button>`
        : '<button type="button" class="ob-btn ghost" id="ob-back">Back</button>'}</span>
      <button type="button" class="ob-btn primary" id="ob-next">${primary}</button>
    </div>`;
  }

  async function refreshDerived() {
    state.derived = await window.tokenTracker.budget.deriveFromMonthly(state.monthly);
    const el = document.getElementById('ob-derived');
    if (el && state.derived) {
      el.textContent = `week ${fmt(state.derived.week.tokens)} - day ${fmt(state.derived.day.tokens)} - session ${fmt(state.derived.session.tokens)}`;
    }
  }

  // Chips are painted by settingsPanel.js's swatchButtonHtml, which reads the
  // colours out of tokens.css at runtime - onboarding must not keep a second copy.
  function renderObSwatches() {
    const grid = document.getElementById('ob-swatch-grid');
    if (!grid || typeof THEME_PALETTES === 'undefined' || typeof swatchButtonHtml !== 'function') return;
    const active = currentPalette();
    const colors = swatchColors(currentMode());
    grid.innerHTML = THEME_PALETTES.map((p) => swatchButtonHtml(p, active, colors)).join('');
  }

  const TH_STEPS = { thBudget: 5, thBurn: 0.5, thWaste: 5, thAgent: 25 };

  function render() {
    const r = root();
    if (!r) return;
    if (!state.open) { r.style.display = 'none'; r.innerHTML = ''; return; }
    r.style.display = '';
    r.innerHTML = `
      <div class="ob-backdrop"></div>
      <div class="ob-card">
        <div class="ob-head">
          <span class="ob-step-label">Step ${state.step + 1} of 6 - ${esc(STEP_LABELS[state.step])}</span>
          ${dots()}
        </div>
        ${stepBody()}
        ${footButtons()}
        ${state.error ? `<div class="ob-error">${esc(state.error)}</div>` : ''}
      </div>`;
    wireStep();
  }

  function wireStep() {
    const next = document.getElementById('ob-next');
    const back = document.getElementById('ob-back');
    const skip = document.getElementById('ob-skip');
    if (next) next.addEventListener('click', onNext);
    if (back) back.addEventListener('click', () => { state.step -= 1; render(); });
    // First run: skip = accept defaults, mark complete. Replay: cancel = close
    // without writing, so a curious click never resets configured budgets/alerts.
    if (skip) skip.addEventListener('click', () => {
      if (state.replay) { state.open = false; render(); return; }
      finish();
    });

    if (state.step === 1) {
      document.getElementById('ob-monthly-minus').addEventListener('click', () => bumpMonthly(-1));
      document.getElementById('ob-monthly-plus').addEventListener('click', () => bumpMonthly(1));
      refreshDerived();
    }
    if (state.step === 2) {
      document.querySelectorAll('.ob-th').forEach((btn) => btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const dir = Number(btn.dataset.dir);
        let v = Math.round((state.alerts[key] + dir * TH_STEPS[key]) * 10) / 10;
        if (thRanges && thRanges[key]) {
          const [min, max] = thRanges[key];
          if (v < min) v = min;
          if (v > max) v = max;
        } else if (v < TH_STEPS[key]) {
          v = TH_STEPS[key];
        }
        state.alerts[key] = v;
        document.getElementById(`ob-${key}`).textContent = state.alerts[key];
      }));
      document.getElementById('ob-alerts-enabled').addEventListener('change', (e) => {
        state.alerts.enabled = e.target.checked;
      });
    }
    if (state.step === 3) {
      renderObSwatches();
      document.getElementById('ob-swatch-grid').addEventListener('click', (e) => {
        const btn = e.target.closest('.swatch-btn');
        if (!btn) return;
        selectPalette(btn.dataset.slug); // settingsPanel.js global; applies live + persists
        renderObSwatches();
      });
    }
    if (state.step === 4) {
      document.getElementById('ob-team-connect').addEventListener('click', async () => {
        const folder = await window.tokenTracker.fleet.pickFolder();
        if (folder) {
          try {
            await window.tokenTracker.fleet.connect(folder);
            state.fleetFolder = folder;
            state.teamChoice = 'connect';
            state.error = null;
          } catch (err) {
            state.error = 'Could not connect to the shared folder';
          }
        }
        render();
      });
      document.getElementById('ob-team-skip').addEventListener('click', () => {
        state.teamChoice = 'skip';
        render();
      });
    }
  }

  function bumpMonthly(dir) {
    const step = state.monthly >= 100_000_000 ? 20_000_000 : 10_000_000;
    state.monthly = Math.max(10_000_000, state.monthly + dir * step);
    document.getElementById('ob-monthly-value').textContent = fmt(state.monthly);
    refreshDerived();
  }

  async function onNext() {
    if (state.step < 5) { state.step += 1; render(); return; }
    await finish();
  }

  async function finish() {
    // Persist everything the wizard configured. Theme already persisted live.
    try {
      const budgets = await window.tokenTracker.budget.deriveFromMonthly(state.monthly);
      await window.tokenTracker.budget.set(budgets);
      await window.tokenTracker.alerts.set(state.alerts);
      await window.tokenTracker.ui.set({ onboardingComplete: true });
    } catch (err) {
      state.error = 'Could not save settings: ' + (err && err.message || 'unknown error');
      render();
      return;
    }
    state.error = null;
    state.open = false;
    render();
  }

  function open(opts) {
    state.replay = !!(opts && opts.replay);
    state.open = true;
    state.step = 0;
    state.error = null;
    render();
    if (state.replay) preloadCurrentConfig();
  }

  // On replay the wizard must show (and re-save) what the user actually has,
  // not the module defaults - otherwise walking through it factory-resets them.
  async function preloadCurrentConfig() {
    try {
      const [budgets, alerts] = await Promise.all([
        window.tokenTracker.budget.get(),
        window.tokenTracker.alerts.get(),
      ]);
      const month = budgets && budgets.month && budgets.month.tokens;
      if (Number.isFinite(month) && month > 0) state.monthly = month;
      if (alerts) {
        for (const k of ['enabled', 'thBudget', 'thBurn', 'thWaste', 'thAgent']) {
          if (alerts[k] !== undefined) state.alerts[k] = alerts[k];
        }
      }
    } catch (e) { /* keep in-memory values; wizard still usable */ }
    if (state.open) render();
  }

  async function mount() {
    const replay = document.getElementById('settings-replay-btn');
    if (replay) replay.addEventListener('click', () => { closeSettings(); open({ replay: true }); }); // closeSettings: settingsPanel.js global
    try {
      thRanges = await window.tokenTracker.alerts.ranges();
    } catch (e) { /* ranges unavailable; stepper falls back to step-size floor */ }
    try {
      const cfg = await window.tokenTracker.ui.get();
      if (!cfg.onboardingComplete) open();
    } catch (e) { /* config unavailable; do not block the app */ }
  }

  window.TT.onboarding = { mount, open, isOpen: () => state.open };
})();
