// src/renderer/dashboard/panels/alerts.js
// Alert banner: stacked severity rows above the hero tiles, expandable
// How-to-fix panel (Why / Recommended fix / action chips), per-row dismiss,
// all-clear card when alerts are enabled and none fire. Dismissals are
// session state only; an alert that stops firing is forgotten so a later
// re-fire shows again. Rendering only - all evaluation is in alertEngine.
(function () {
  const dismissed = new Set(); // alert ids dismissed this session
  let expandedId = null;       // one fix panel open at a time
  let toastDismissedId = null; // separate from banner dismissals: X on the toast

  function chipHtml(alertId, chip, i) {
    return `<button type="button" class="alert-chip" data-alert="${escapeHtml(alertId)}" data-chip="${i}">
      ${escapeHtml(chip.label)}${chip.kind === 'copy' ? ' &#10697;' : ''}</button>`;
  }

  function rowHtml(a) {
    const open = expandedId === a.id;
    const chips = (a.chips || []).map((c, i) => chipHtml(a.id, c, i)).join('');
    return `
      <div class="alert-unit">
        <div class="alert-row ${a.severity}${open ? ' open' : ''}" data-id="${escapeHtml(a.id)}">
          <span class="alert-icon">${a.severity === 'critical' ? '&#9888;' : '&#9650;'}</span>
          <span class="alert-body">
            <span class="alert-title">${escapeHtml(a.title)}</span>
            <span class="alert-detail">${escapeHtml(a.detail)}</span>
          </span>
          <button type="button" class="alert-fix-btn" data-id="${escapeHtml(a.id)}">${open ? 'Hide' : 'How to fix &#9662;'}</button>
          <button type="button" class="alert-dismiss" data-id="${escapeHtml(a.id)}" title="Dismiss" aria-label="Dismiss">&#215;</button>
        </div>
        ${open ? `
        <div class="alert-fix-panel ${a.severity}">
          <div class="alert-fix-label">Why</div>
          <div class="alert-fix-why">${escapeHtml(a.why)}</div>
          <div class="alert-fix-label rec">Recommended fix</div>
          <div class="alert-fix-rec">${escapeHtml(a.fix)}</div>
          <div class="alert-chips">${chips}</div>
        </div>` : ''}
      </div>`;
  }

  function renderToast(alerts) {
    const el = document.getElementById('cli-toast');
    if (!el) return;
    // Most severe active alert, skipping banner-dismissed and toast-dismissed.
    const top = alerts.find((a) => !dismissed.has(a.id) && a.id !== toastDismissedId);
    if (toastDismissedId && !alerts.some((a) => a.id === toastDismissedId)) toastDismissedId = null;
    if (!top) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    el.innerHTML = `
      <span class="cli-toast-icon ${top.severity}">${top.severity === 'critical' ? '&#9888;' : '&#9650;'}</span>
      <span class="cli-toast-body">
        <span class="cli-toast-title">${escapeHtml(top.title)}</span>
        <span class="cli-toast-detail">${escapeHtml(top.detail)}</span>
      </span>
      <button type="button" class="cli-toast-dismiss" data-id="${escapeHtml(top.id)}" title="Dismiss" aria-label="Dismiss">&#215;</button>`;
  }

  function render(state) {
    const el = document.getElementById('alerts-banner');
    if (!el) return;
    const alerts = state.alerts || [];
    // Forget dismissals for alerts no longer firing so a re-fire reappears.
    const activeIds = new Set(alerts.map((a) => a.id));
    for (const id of [...dismissed]) if (!activeIds.has(id)) dismissed.delete(id);
    if (expandedId && !activeIds.has(expandedId)) expandedId = null;

    // Toast must track every render path including all-clear transitions.
    renderToast(alerts);

    const visible = alerts.filter((a) => !dismissed.has(a.id));
    if (alerts.length === 0 && state.alertsEnabled) {
      el.innerHTML = `<div class="alert-allclear"><span class="alert-allclear-check">&#10003;</span>
        All healthy - no waste detected</div>`;
      return;
    }
    el.innerHTML = visible.map(rowHtml).join('');
    // Stash current alerts so click handlers can find chips by index.
    el.__alerts = alerts;
  }

  function onBannerClick(e) {
    const el = document.getElementById('alerts-banner');
    const fixBtn = e.target.closest('.alert-fix-btn');
    if (fixBtn) {
      expandedId = expandedId === fixBtn.dataset.id ? null : fixBtn.dataset.id;
      if (el.__lastState) render(el.__lastState);
      return;
    }
    const dismissBtn = e.target.closest('.alert-dismiss');
    if (dismissBtn) {
      dismissed.add(dismissBtn.dataset.id);
      if (expandedId === dismissBtn.dataset.id) expandedId = null;
      if (el.__lastState) render(el.__lastState);
      return;
    }
    const chipBtn = e.target.closest('.alert-chip');
    if (chipBtn) {
      const alerts = el.__alerts || [];
      const alert = alerts.find((a) => a.id === chipBtn.dataset.alert);
      const chip = alert && alert.chips[Number(chipBtn.dataset.chip)];
      if (!chip) return;
      if (chip.kind === 'apply') {
        window.TT.optimize.openApply(chip.findingId, chip.title);
      } else {
        window.tokenTracker.clipboard.write(chip.text).catch(() => {});
        chipBtn.classList.add('copied');
        const prior = chipBtn.textContent;
        chipBtn.textContent = 'copied';
        setTimeout(() => { chipBtn.classList.remove('copied'); chipBtn.textContent = prior; }, 900);
      }
    }
  }

  function mount() {
    const el = document.getElementById('alerts-banner');
    if (el) el.addEventListener('click', onBannerClick);
    const toast = document.getElementById('cli-toast');
    if (toast) toast.addEventListener('click', (e) => {
      const btn = e.target.closest('.cli-toast-dismiss');
      if (!btn) return;
      toastDismissedId = btn.dataset.id;
      const el = document.getElementById('alerts-banner');
      if (el && el.__lastState) renderWithMemo(el.__lastState);
    });
  }

  function renderWithMemo(state) {
    const el = document.getElementById('alerts-banner');
    if (el) el.__lastState = state;
    render(state);
  }

  window.TT.alertsPanel = { mount, render: renderWithMemo, getDismissed: () => dismissed };
})();
