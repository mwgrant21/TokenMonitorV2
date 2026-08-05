// src/renderer/dashboard/panels/viewToggle.js
// Personal/Team segmented toggle. Owns pane visibility + uiConfig.view
// persistence. Seats-chip TEXT is owned by fleet.js; visibility is owned here.
(function () {
  let view = 'personal';

  function apply() {
    const personal = view === 'personal';
    const show = (id, on) => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? '' : 'none';
    };
    show('terminal-pane', personal);
    show('pane-divider', personal);
    show('dashboard-pane', personal);
    show('settings-wrap', personal);
    show('hdr-tools', personal);
    show('fleet-pane', !personal);
    show('seats-chip', !personal);
    const pBtn = document.getElementById('view-personal');
    const tBtn = document.getElementById('view-team');
    if (pBtn) pBtn.classList.toggle('active', personal);
    if (tBtn) tBtn.classList.toggle('active', !personal);
  }

  function set(next) {
    if (next !== 'personal' && next !== 'team') return;
    view = next;
    apply();
    if (next === 'team' && typeof refreshFleetView === 'function') refreshFleetView();
    window.tokenTracker.ui.set({ view: next }).catch(() => {});
  }

  async function mount() {
    const pBtn = document.getElementById('view-personal');
    const tBtn = document.getElementById('view-team');
    if (pBtn) pBtn.addEventListener('click', () => set('personal'));
    if (tBtn) tBtn.addEventListener('click', () => set('team'));
    try {
      const ui = await window.tokenTracker.ui.get();
      if (ui && (ui.view === 'personal' || ui.view === 'team')) view = ui.view;
    } catch (err) { /* keep personal default */ }
    apply();
  }

  window.TT.view = { mount, set, get: () => view };
})();
