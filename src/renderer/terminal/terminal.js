// src/renderer/terminal/terminal.js
//
// Deviation from the plan: the plan used `import { Terminal } from 'xterm'`
// inside a `<script type="module">`. Bare module specifiers do not resolve
// in an Electron renderer without a bundler, and nodeIntegration is off here.
// Instead this is loaded as a plain classic <script> after xterm's UMD build
// (node_modules/xterm/lib/xterm.js), which attaches `Terminal` to the global
// scope. Behavior and structure otherwise match the plan.
function mountTerminal(containerEl) {
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    theme: { background: '#0b0e14', foreground: '#e7ebf3' },
  });
  const fit = new FitAddon.FitAddon(); // UMD global from xterm-addon-fit script tag
  term.loadAddon(fit);
  term.open(containerEl);
  fit.fit();

  // xterm forwards every keystroke to the pty by default, so Ctrl+C stays SIGINT
  // and there is no copy/paste. Wire the familiar Windows-terminal behaviour:
  //   Ctrl+C  -> copy when text is selected, otherwise fall through as SIGINT
  //   Ctrl+V  -> paste from the clipboard
  //   Ctrl+Shift+C / Ctrl+Shift+V -> explicit copy / paste
  // Native Ctrl+V does not paste in this packaged app, so handling it here does
  // not double-paste. Note: under a TUI that grabs the mouse (e.g. Claude Code),
  // drag-selection is disabled by the app; hold Shift while dragging to select.
  function copySelection() {
    const sel = term.getSelection();
    if (!sel) return false;
    window.tokenTracker.clipboard.write(sel);
    term.clearSelection();
    return true;
  }
  function pasteClipboard() {
    window.tokenTracker.clipboard.read().then((text) => { if (text) term.paste(text); });
  }
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !e.ctrlKey || e.altKey || e.metaKey) return true;
    if (e.code === 'KeyC') {
      if (copySelection()) return false;   // copied a selection; swallow the key
      if (e.shiftKey) return false;        // Ctrl+Shift+C, no selection: do nothing
      return true;                         // plain Ctrl+C, no selection: SIGINT
    }
    if (e.code === 'KeyV') {
      // xterm also has a native browser-paste handler that fires on Ctrl+V;
      // preventDefault stops it so we don't paste twice.
      e.preventDefault();
      pasteClipboard();
      return false;
    }
    return true;
  });

  // Right-click: copy the selection if there is one, else paste.
  containerEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!copySelection()) pasteClipboard();
  });

  // Keep the pty's size in lockstep with the visible grid (initial + every refit).
  term.onResize(({ cols, rows }) => window.tokenTracker.pty.resize(cols, rows));
  window.tokenTracker.pty.start({ cwd: undefined, cols: term.cols, rows: term.rows });
  window.tokenTracker.pty.onData((data) => term.write(data));
  term.onData((input) => window.tokenTracker.pty.write(input));

  window.__ttFit = () => fit.fit();
  window.addEventListener('resize', () => fit.fit());

  applyTerminalTheme(term);
  // Expose the mounted term so the dashboard can re-theme it on a palette change.
  window.__ttTerm = term;

  return term;
}

// Recolor the xterm instance from the active CSS palette. The CSS palette
// ([data-palette] on <html>) is the single source of truth; we only read the
// computed variables here, never hardcode a second copy of the colors.
function applyTerminalTheme(term) {
  const cs = getComputedStyle(document.documentElement);
  const background = cs.getPropertyValue('--bg').trim();
  const foreground = cs.getPropertyValue('--tx').trim();
  const cursor = cs.getPropertyValue('--acc').trim();
  if (!background) return; // CSS not ready; keep constructor defaults
  term.options.theme = { background, foreground, cursor };
}
