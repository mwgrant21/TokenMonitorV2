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
        <div class="plan-usage-hint">plan unknown - press Sync or run /usage in the terminal${syncState === 'failed' ? ' \u00b7 last sync failed' : ''}</div>
        <div class="plan-divider"></div>`;
    }
    const tierLabel = pu.tier === 'max' ? 'Max' : pu.tier === 'pro' ? 'Pro' : '?';
    const age = pu.ageMinutes <= 0 ? 'just now' : `${pu.ageMinutes}m ago`;
    return `
      <div class="plan-usage-head"><span class="hero-label">Plan usage \u00b7 ${tierLabel}</span>${syncBtn}</div>
      ${planBar('Session (5h)', pu.session.pct)}
      ${planBar('Week', pu.week.pct)}
      ${pu.weekModel ? planBar('Week (model)', pu.weekModel.pct) : ''}
      <div class="plan-usage-meta">resets ${escapeHtml(pu.week.resetsAt)} \u00b7 as of ${age}${syncState === 'failed' ? ' \u00b7 last sync failed' : ''}</div>
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
