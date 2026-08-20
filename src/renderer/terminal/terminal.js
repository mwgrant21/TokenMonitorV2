// src/renderer/terminal/terminal.js
//
// Deviation from the plan: the plan used `import { Terminal } from 'xterm'`
// inside a `<script type="module">`. Bare module specifiers do not resolve
// in an Electron renderer without a bundler, and nodeIntegration is off here.
// Instead this is loaded as a plain classic <script> after xterm's UMD build
// (node_modules/xterm/lib/xterm.js), which attaches `Terminal` to the global
// scope. Behavior and structure otherwise match the plan.
function mountTerminal(containerEl) {
  // Read the initial theme from tokens.css's computed custom properties instead of
  // hardcoding literals, so the very first paint already matches the active palette
  // (data-pal/data-mode on <html>) rather than always starting dark. Same read
  // pattern as applyTerminalTheme() below.
  const initialCs = getComputedStyle(document.documentElement);
  const initialBackground = initialCs.getPropertyValue('--bg-term').trim();
  const initialForeground = initialCs.getPropertyValue('--tx-primary').trim();
  // xterm takes a plain font-family string, not a CSS var(), so read the resolved
  // --f-mono the same way. Aether palettes give Space Mono, flat/legacy ones give
  // JetBrains Mono; the literal below is only the CSS-not-ready fallback.
  const initialFont = initialCs.getPropertyValue('--f-mono').trim();
  const term = new Terminal({
    fontFamily: initialFont || "'JetBrains Mono', monospace",
    fontSize: 12.5,
    theme: { background: initialBackground, foreground: initialForeground },
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
// (data-pal/data-mode on <html>, defined in tokens.css) is the single source of
// truth; we only read the computed variables here, never hardcode a second copy
// of the colors. Reads the same --bg-term/--tx-primary the constructor above
// uses, so the mounted terminal never disagrees with its own first paint.
function applyTerminalTheme(term) {
  const cs = getComputedStyle(document.documentElement);
  const background = cs.getPropertyValue('--bg-term').trim();
  const foreground = cs.getPropertyValue('--tx-primary').trim();
  const cursor = cs.getPropertyValue('--acc').trim();
  const fontFamily = cs.getPropertyValue('--f-mono').trim();
  if (!background) return; // CSS not ready; keep constructor defaults
  term.options.theme = { background, foreground, cursor };
  // Aether <-> legacy palette switches also swap --f-mono, so follow it here or the
  // terminal keeps the previous palette's typeface until the app restarts. A new family
  // means new cell metrics, so refit -- otherwise the grid keeps the old font's rows/cols
  // and the pty's size drifts out of lockstep with what is drawn.
  if (fontFamily && term.options.fontFamily !== fontFamily) {
    term.options.fontFamily = fontFamily;
    if (typeof window.__ttFit === 'function') window.__ttFit();
  }
}
