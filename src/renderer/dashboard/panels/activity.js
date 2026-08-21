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
