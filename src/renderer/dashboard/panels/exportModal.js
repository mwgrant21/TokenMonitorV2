// src/renderer/dashboard/panels/exportModal.js
// Export modal: format cards + range chips -> export:run IPC. All file paths
// are computed in the main process; this panel only displays the result.
(function () {
  let fmt = 'csv';
  let scope = 'session';
  let modalOpen = false;
  let running = false;
  let closeTimer = null;

  function el(id) { return document.getElementById(id); }

  function isOpen() { return modalOpen; }

  async function open() {
    modalOpen = true;
    running = false;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    el('export-status').textContent = '';
    el('export-status').className = 'export-status';
    el('export-body').style.display = '';
    el('export-done').style.display = 'none';
    el('export-backdrop').style.display = 'block';
    el('export-modal').style.display = 'block';
    try {
      const ui = await window.tokenTracker.ui.get();
      el('export-scope-label').textContent = ui.view === 'team' ? 'Team roll-up' : 'My usage';
    } catch (e) {
      el('export-scope-label').textContent = 'My usage';
    }
  }

  function close() {
    modalOpen = false;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    el('export-backdrop').style.display = 'none';
    el('export-modal').style.display = 'none';
  }

  function select(rowId, cardSel, dataKey, value) {
    el(rowId).querySelectorAll(cardSel).forEach((c) => {
      c.classList.toggle('selected', c.dataset[dataKey] === value);
    });
  }

  async function run() {
    if (running) return;
    running = true;
    const status = el('export-status');
    status.textContent = 'Generating...';
    status.className = 'export-status';
    let res;
    try {
      res = await window.tokenTracker.export.run({ format: fmt, scope });
    } catch (e) {
      res = { ok: false, error: e && e.message ? e.message : String(e) };
    }
    running = false;
    if (!res || !res.ok) {
      status.textContent = `Export failed: ${res && res.error ? res.error : 'unknown error'}`;
      status.className = 'export-status error';
      return;
    }
    el('export-body').style.display = 'none';
    el('export-done').style.display = '';
    el('export-done-path').textContent = `saved to ${res.dir}`;
    el('export-done-fallback').style.display = res.fallback ? '' : 'none';
    closeTimer = setTimeout(close, 1400);
  }

  function mount() {
    const btn = el('export-btn');
    if (btn) btn.addEventListener('click', open);
    el('export-fmt-row').addEventListener('click', (e) => {
      const card = e.target.closest('.export-fmt-card');
      if (!card) return;
      fmt = card.dataset.fmt;
      select('export-fmt-row', '.export-fmt-card', 'fmt', fmt);
    });
    el('export-range-row').addEventListener('click', (e) => {
      const chip = e.target.closest('.export-chip');
      if (!chip) return;
      scope = chip.dataset.scope;
      select('export-range-row', '.export-chip', 'scope', scope);
    });
    el('export-backdrop').addEventListener('click', close);
    el('export-close-btn').addEventListener('click', close);
    el('export-cancel-btn').addEventListener('click', close);
    el('export-run-btn').addEventListener('click', run);
  }

  window.TT.exportModal = { mount, open, close, isOpen };
})();
