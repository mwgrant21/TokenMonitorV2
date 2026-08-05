// src/renderer/dashboard/panels/shortcuts.js
(function () {
  let keymap = {};
  let helpOpen = false;

  const HELP_GROUPS = [
    { title: 'Period', rows: [['1', 'Today'], ['2', '7 days'], ['3', '30 days'], ['4', 'Month']] },
    { title: 'Actions', rows: [['I', 'Toggle insights'], ['E', 'Export report'], ['P', 'Personal view'], ['T', 'Team view'], ['M', 'Mini mode'], [',', 'Settings'], ['?', 'This help'], ['Esc', 'Close overlay']] },
  ];

  function renderHelp() {
    const el = document.getElementById('shortcut-help');
    if (!el) return;
    if (!helpOpen) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = `
      <div class="help-backdrop"></div>
      <div class="help-card">
        <div class="help-title">Keyboard shortcuts</div>
        ${HELP_GROUPS.map((g) => `
          <div class="help-group">${g.title}</div>
          ${g.rows.map(([k, label]) => `<div class="help-row"><kbd>${k}</kbd><span>${label}</span></div>`).join('')}
        `).join('')}
      </div>`;
    el.querySelector('.help-backdrop').addEventListener('click', () => { helpOpen = false; renderHelp(); });
  }

  function isTyping() {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable
      || a.closest('#terminal-pane') !== null); // keys typed into the CLI belong to the CLI
  }

  function dispatch(action) {
    if (action.startsWith('period:')) { window.TT.period.set(action.split(':')[1]); return; }
    if (action === 'insights:toggle') { window.TT.insights.toggle(); return; }
    if (action === 'export:open') { window.TT.exportModal.open(); return; }
    if (action.startsWith('view:')) {
      if (window.TT.view) window.TT.view.set(action.split(':')[1]);
      return;
    }
    if (action === 'mini:toggle') {
      if (window.TT.mini) window.TT.mini.toggle();
      return;
    }
    if (action === 'settings:toggle') { toggleSettings(); return; } // settingsPanel.js global
    if (action === 'help:toggle') { helpOpen = !helpOpen; renderHelp(); return; }
    if (action === 'overlay:close') {
      if (window.TT.exportModal && window.TT.exportModal.isOpen()) { window.TT.exportModal.close(); return; }
      if (helpOpen) { helpOpen = false; renderHelp(); return; }
      closeSettings(); // settingsPanel.js global; harmless if already closed
    }
  }

  // Mirror of src/shared/shortcutMap.js resolveShortcut, fed by the map IPC so
  // the key->action table itself is never duplicated.
  function resolve(key, ctx) {
    if (ctx.typing || ctx.onboardingOpen || ctx.modifier) return null;
    return keymap[key] || null;
  }

  async function mount() {
    try {
      keymap = await window.tokenTracker.shortcuts.map();
    } catch (err) {
      console.error('shortcuts: keymap IPC failed, shortcuts disabled', err);
    }
    window.addEventListener('keydown', (e) => {
      const raw = e.key === '/' && e.shiftKey ? '?' : e.key;
      const key = raw.length === 1 ? raw.toLowerCase() : raw;
      const action = resolve(key, {
        typing: isTyping(),
        onboardingOpen: window.TT.onboarding && window.TT.onboarding.isOpen(),
        modifier: e.ctrlKey || e.metaKey || e.altKey,
      });
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    });
  }

  window.TT.shortcuts = { mount };
})();
