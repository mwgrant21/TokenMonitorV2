// src/renderer/dashboard/panels/insights.js
// Insights stack: burn-trend SVG, forecast, spend-by-project, recent sessions.
// All numbers come precomputed on state.insights (historyAggregator in main);
// this file only renders. Visibility persists as panelsConfig.showInsights.
(function () {
  const LBL = { today: 'Today', '7d': '7 Days', '30d': '30 Days', month: 'Month' };
  let visible = false;

  function applyVisibility() {
    const panel = document.getElementById('insights-panel');
    if (panel) panel.style.display = visible ? '' : 'none';
    const btn = document.getElementById('insights-btn');
    if (btn) btn.classList.toggle('active', visible);
  }

  // Mockup geometry: 900x150 viewBox, pad 6, 12% headroom, min pinned to 0.
  function chartSvg(series) {
    const pts = series.points || [];
    if (!pts.length) return '<div class="insights-empty">no data yet.</div>';
    const w = 900; const h = 150; const pad = 6; const n = pts.length;
    const max = Math.max(1, ...pts.map((p) => p.tokens)) * 1.12;
    const X = (i) => (n === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1));
    const Y = (v) => h - pad - (v / max) * (h - 2 * pad);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.tokens).toFixed(1)).join(' ');
    const area = `${line} L${X(n - 1).toFixed(1)} ${h - pad} L${X(0).toFixed(1)} ${h - pad} Z`;
    const peak = series.peakIndex >= 0
      ? `<circle cx="${X(series.peakIndex).toFixed(1)}" cy="${Y(pts[series.peakIndex].tokens).toFixed(1)}" r="4.5" style="fill:var(--warn);stroke:var(--bg);stroke-width:2"></circle>`
      : '';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:150px;display:block"><path d="${area}" style="fill:var(--acc);fill-opacity:.13;stroke:none"></path><path d="${line}" style="fill:none;stroke:var(--acc);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round"></path>${peak}</svg>`;
  }

  function trendCard(state) {
    const series = state.insights.series;
    const le = series.labelEvery || 1;
    const labels = series.points
      .map((p, i) => `<span>${i % le === 0 ? escapeHtml(p.label) : ''}</span>`)
      .join('');
    return `<div class="insights-card">
      <div class="insights-head"><div class="hero-label">Daily burn \u00b7 ${escapeHtml(LBL[state.period] || '')}</div>
        <div class="insights-legend"><span class="insights-legend-dot"></span>peak</div></div>
      ${chartSvg(series)}
      <div class="insights-axis">${labels}</div>
    </div>`;
  }

  function forecastCard(state) {
    const f = state.insights.forecast;
    return `<div class="insights-card forecast">
      <div class="hero-label" style="margin-bottom:12px">Forecast</div>
      <div class="forecast-value">${formatMoney(f.proj)}</div>
      <div class="forecast-status ${f.over ? 'over' : 'ok'}">${escapeHtml(f.status)}</div>
      <div class="forecast-note">${escapeHtml(f.note)}</div>
    </div>`;
  }

  function projectsCard(state) {
    const rows = (state.insights.projects || []).map((p) => `
      <div class="proj-row">
        <span class="proj-name">${escapeHtml(p.name)}</span>
        <div class="proj-track"><div class="proj-fill" style="width:${p.pct}%;opacity:${(0.55 + p.pct / 240).toFixed(2)}"></div></div>
        <span class="proj-val">${formatMoney(p.spend)}</span>
      </div>`).join('');
    return `<div class="insights-card">
      <div class="hero-label">Spend by project</div>
      ${rows || '<div class="insights-empty" style="margin-top:8px">no project spend yet.</div>'}
    </div>`;
  }

  function sessionsCard(state) {
    const rows = (state.insights.sessions || []).map((s) => `
      <div class="sess-row">
        <span class="sess-dot${s.active ? ' live' : ''}"></span>
        <span class="sess-primary">${escapeHtml(s.project)}</span>
        <span class="sess-secondary">${escapeHtml(s.task)}</span>
        <span class="sess-time">${escapeHtml(s.timeLabel)}</span>
        <span class="sess-spend">$${s.spend.toFixed(2)}</span>
      </div>`).join('');
    return `<div class="insights-card">
      <div class="hero-label" style="margin-bottom:4px">Recent sessions</div>
      ${rows || '<div class="insights-empty" style="margin-top:8px">no sessions yet.</div>'}
    </div>`;
  }

  function render(state) {
    const el = document.getElementById('insights-panel');
    if (!el || !state.insights) return;
    if (!visible) return; // don't build HTML for a hidden stack
    el.innerHTML = `${trendCard(state)}<div class="insights-grid">${forecastCard(state)}${projectsCard(state)}</div>${sessionsCard(state)}`;
  }

  async function toggle() {
    visible = !visible;
    applyVisibility();
    try {
      await window.tokenTracker.panels.set({ showInsights: visible });
      const state = await window.tokenTracker.dashboard.getState();
      if (window.TT.renderDashboard) window.TT.renderDashboard(state);
    } catch (e) { /* visibility already applied; persistence is best-effort */ }
  }

  async function mount() {
    const btn = document.getElementById('insights-btn');
    if (btn) btn.addEventListener('click', toggle);
    try {
      const cfg = await window.tokenTracker.panels.get();
      visible = !!cfg.showInsights;
    } catch (e) { visible = false; }
    applyVisibility();
  }

  window.TT.insights = { mount, render, toggle, isVisible: () => visible };
})();
