// src/renderer/dashboard/dashboard.js
// Orchestrator only: subscribes to dashboard state and fans out to the
// window.TT panels. All rendering lives in panels/*.js.
function mountDashboard() {
  const render = (state) => {
    window.TT.heroTiles.render(state);
    window.TT.insights.render(state);
    window.TT.budgetsPanel.render(state);
    window.TT.activity.render(state);
    window.TT.optimize.render(state);
    window.TT.alertsPanel.render(state);
    window.TT.mini.render(state);
    window.TT.footer.render(state);
  };
  window.TT = window.TT || {};
  window.TT.renderDashboard = render;
  window.TT.optimize.mountApplyDialog();
  window.TT.alertsPanel.mount();
  window.TT.insights.mount();
  window.TT.exportModal.mount();
  window.TT.footer.mount();
  window.tokenTracker.dashboard.getState().then(render);
  window.tokenTracker.dashboard.onUpdate(render);
}
