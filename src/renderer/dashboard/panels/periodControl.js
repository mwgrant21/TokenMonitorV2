// src/renderer/dashboard/panels/periodControl.js
(function () {
  const PERIODS = ['today', '7d', '30d', 'month'];

  async function set(period) {
    if (!PERIODS.includes(period)) return;
    await window.tokenTracker.dashboard.setPeriod(period);
    document.querySelectorAll('#period-seg .period-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });
    // Pull a fresh state immediately instead of waiting for the 1s push.
    const state = await window.tokenTracker.dashboard.getState();
    if (window.TT.renderDashboard) window.TT.renderDashboard(state);
  }

  function mount() {
    const seg = document.getElementById('period-seg');
    if (!seg) return;
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('.period-btn');
      if (btn) set(btn.dataset.period);
    });
  }

  window.TT.period = { mount, set, PERIODS };
})();
