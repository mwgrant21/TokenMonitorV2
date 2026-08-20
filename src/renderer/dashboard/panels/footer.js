// src/renderer/dashboard/panels/footer.js
// App footer status strip: running version, fleet share path, seat count, alarm
// state. All four reuse existing data/IPC -- no new backend logic beyond the
// app:version handle (main.js/preload.js). Version is fetched once (it never
// changes at runtime); fleet path/seats are refreshed by fleet.js's existing
// poll loop (renderFleet), and alarm state is derived from dashboard:getState's
// existing `alerts` array (already sorted criticals-first by alertEngine.js) on
// every dashboard render fan-out.
(function () {
  function alarmFromAlerts(alerts) {
    if (!alerts || !alerts.length) return { label: 'NOMINAL', cls: '' };
    return alerts[0].severity === 'critical'
      ? { label: 'CRITICAL', cls: 'crit' }
      : { label: 'WARNING', cls: 'warn' };
  }

  function renderVersion() {
    const el = document.getElementById('footer-version');
    if (!el || !window.tokenTracker || !window.tokenTracker.app) return;
    window.tokenTracker.app.getVersion()
      .then((v) => { el.textContent = `v${v}`; })
      .catch(() => {});
  }

  function render(state) {
    const el = document.getElementById('footer-alarm');
    if (!el) return;
    const { label, cls } = alarmFromAlerts(state && state.alerts);
    el.textContent = label;
    el.className = `footer-alarm${cls ? ` ${cls}` : ''}`;
  }

  // Called by fleet.js's refreshFleetView (same poll cycle that already
  // updates the header's #seats-chip) -- no separate footer polling.
  function renderFleet(fleetState) {
    const pathEl = document.getElementById('footer-fleet-path');
    const seatsEl = document.getElementById('footer-seats');
    if (pathEl) {
      pathEl.textContent = fleetState && fleetState.folder ? fleetState.folder : 'fleet: not connected';
    }
    if (seatsEl) {
      seatsEl.textContent = fleetState && fleetState.connected && fleetState.chip
        ? `${fleetState.chip.reporting}/${fleetState.chip.total} seats`
        : '';
    }
  }

  function mount() {
    renderVersion();
  }

  window.TT = window.TT || {};
  window.TT.footer = { mount, render, renderFleet };
})();
