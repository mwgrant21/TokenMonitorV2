// src/renderer/dashboard/panels/footerStatus.js
// Footer alarm-state readout: a persistent global severity indicator,
// independent of the alerts banner's per-row dismiss state (alertsPanel.js) -
// dismissing a banner row shouldn't make the footer claim everything is fine.
(function () {
  function render(state) {
    const el = document.getElementById('footer-status');
    if (!el) return;
    const top = (state.alerts || [])[0]; // alertEngine sorts criticals first
    el.classList.remove('warning', 'critical');
    if (!top) { el.textContent = 'OK'; return; }
    el.classList.add(top.severity);
    el.textContent = top.severity === 'critical' ? 'CRITICAL' : 'WARNING';
  }

  window.TT.footerStatus = { render };
})();
