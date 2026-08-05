// src/renderer/dashboard/panels/paneResize.js
(function () {
  const MIN = 340, MAX = 920;

  function mount() {
    const divider = document.getElementById('pane-divider');
    const pane = document.getElementById('terminal-pane');
    if (!divider || !pane) return;

    let dragging = false;

    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      divider.classList.add('dragging');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const width = Math.min(MAX, Math.max(MIN, e.clientX));
      pane.style.flex = `0 0 ${width}px`;
      if (window.__ttFit) window.__ttFit();
    });

    window.addEventListener('mouseup', async () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('dragging');
      const width = pane.getBoundingClientRect().width;
      await window.tokenTracker.ui.set({ cliWidth: Math.round(width) }).catch(() => {});
    });
  }

  window.TT.paneResize = { mount };
})();
