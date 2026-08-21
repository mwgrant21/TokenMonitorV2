// src/renderer/dashboard/panels/miniMode.js
// Compact companion widget. Layout swap is a body class; window sizing and
// always-on-top live main-side behind window:setMini. Renders from the same
// pushed dashboard state as the full view - nothing recomputed here.
(function () {
  let mini = false;
  let latest = null;

  function render(state) {
    latest = state;
    if (!mini) return;
    const el = document.getElementById('mini-root');
    if (!el) return;
    const alert = (state.alerts && state.alerts[0]) || null;
    const bars = ['session', 'day', 'week', 'month']
      .map((period) => {
        const { used, limit } = state.budgetVsQuota[period];
        const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
        const tier = window.TT.budgetsPanel.tierFor(state, period);
        return `
        <div class="mini-bar-row">
          <span class="mini-bar-label">${period[0].toUpperCase()}${period.slice(1)}</span>
          <div class="mini-track"><div class="mini-fill${tier === 'critical' ? ' crit' : tier === 'warning' ? ' warn' : ''}" style="width:${pct}%"></div></div>
          <span class="mini-bar-pct">${Math.round(pct)}%</span>
        </div>`;
      })
      .join('');
    el.innerHTML = `
      <div class="mini-title">
        <span class="mini-live"></span>
        <span class="mini-name">Token Tracker</span>
        <span class="mini-spend">$${state.heroTiles.spend.toFixed(2)} \u00b7 ${escapeHtml(state.period)}</span>
        <button type="button" id="mini-expand-btn" title="Expand" aria-label="Expand">&#9974;</button>
      </div>
      <div class="mini-burn">${formatTokens(state.heroTiles.burnRate)}<span class="mini-burn-unit">tok/min</span></div>
      <div class="mini-agents">${(state.runningAgents || []).length} agents running</div>
      <div class="mini-bars">${bars}</div>
      ${alert ? `<div class="mini-alert ${alert.severity}">${alert.severity === 'critical' ? '&#9888;' : '&#9650;'} ${escapeHtml(alert.title)}</div>` : ''}`;
    document.getElementById('mini-expand-btn').addEventListener('click', () => set(false));
  }

  function set(on) {
    if (mini === on) return;
    mini = on;
    document.body.classList.toggle('mini', on);
    window.tokenTracker.window.setMini(on).catch(() => {});
    if (on && latest) render(latest);
  }

  function toggle() {
    set(!mini);
  }

  function mount() {
    const btn = document.getElementById('mini-btn');
    if (btn) btn.addEventListener('click', () => set(true));
  }

  window.TT.mini = { render, set, toggle, mount, isMini: () => mini };
})();
