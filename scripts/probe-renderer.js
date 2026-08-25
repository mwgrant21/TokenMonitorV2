#!/usr/bin/env node
// scripts/probe-renderer.js
//
// Loads src/renderer/index.html in a real headless Chromium and reports what the
// styling actually resolves to. Development tool; nothing in the app depends on it.
//
//   npx electron scripts/probe-renderer.js                  # all checks
//   npx electron scripts/probe-renderer.js tokens fonts     # named checks only
//
// Why this exists rather than a screenshot or a DevTools session: the reskin's
// failure modes are all invisible. An empty CSS custom property renders as a
// transparent chip that looks plausible against a dark panel. A font 404 falls
// through to Bahnschrift, which also changes the look. An overridden alias layer
// paints a coherent app in the wrong palette. None of that is visible by eye, and
// all of it is one getComputedStyle call away.
//
// Two traps this file encodes, both of which produced a false alarm during phases
// 3-4 before being understood:
//
//   1. document.fonts.check() never triggers a fetch. In an offscreen window it
//      returns false for a perfectly correct @font-face simply because nothing has
//      painted text in it. Use document.fonts.load(), which forces the fetch.
//   2. data-pal alone is not a complete palette selection. tokens.css maps
//      --panel-grad onto the flat tokens via html[data-lang="flat"], so probing a
//      legacy palette without also setting data-lang reports panels as having
//      neither gradient nor colour - a bug that is not there.
//
// Anything the app renders through IPC is absent here: the boot IIFE needs the
// preload bridge and will have thrown. The classic scripts' top-level definitions
// are unaffected, which is why the renderer's own globals can still be called.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const INDEX = path.join(REPO, 'src', 'renderer', 'index.html');

const AETHER = ['cyan', 'azure', 'violet', 'emerald', 'steel'];
const LEGACY = ['midnight', 'slate', 'carbon', 'nord', 'onedark',
                'solarized', 'catppuccin', 'github', 'graphite'];

// Each check is a function body evaluated in the renderer, returning plain JSON.
const CHECKS = {
  // Do the self-hosted faces actually resolve? load(), not check().
  fonts: `
    (async () => {
      await document.fonts.ready;
      const SPECS = ['400 12px Rajdhani', '500 12px Rajdhani', '600 12px Rajdhani',
                     '700 12px Rajdhani', '400 12px "Space Mono"', '700 12px "Space Mono"'];
      const loaded = {};
      for (const spec of SPECS) {
        try {
          const faces = await document.fonts.load(spec);
          loaded[spec] = faces.length > 0 && document.fonts.check(spec);
        } catch (e) { loaded[spec] = 'ERROR: ' + e.message; }
      }
      const failed = Object.entries(loaded).filter(([, v]) => v !== true).map(([k]) => k);
      return { loaded, failed, ok: failed.length === 0 };
    })()`,

  // Does every palette resolve real colours, and do the v1 aliases follow them?
  // A blank value here is the transparent-chip failure.
  tokens: `
    (() => {
      const root = document.documentElement;
      const AETHER = ${JSON.stringify(AETHER)};
      const ALL = AETHER.concat(${JSON.stringify(LEGACY)});
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const prev = [root.dataset.pal, root.dataset.mode, root.dataset.lang];
      const rows = {};
      const blank = [];
      for (const pal of ALL) {
        for (const mode of (AETHER.includes(pal) ? ['dark', 'light'] : ['dark'])) {
          root.dataset.pal = pal;
          root.dataset.mode = mode;
          // Setting data-lang matters: the flat block is what maps --panel-grad.
          root.dataset.lang = AETHER.includes(pal) ? 'aether' : 'flat';
          const cs = getComputedStyle(root);
          const bgBase = cs.getPropertyValue('--bg-base').trim();
          const acc = cs.getPropertyValue('--acc').trim();
          probe.style.color = 'var(--bg)';   // v1 alias -> should track --bg-base
          const aliasBg = getComputedStyle(probe).color;
          const key = mode === 'dark' ? pal : pal + '/' + mode;
          rows[key] = { bgBase, acc, aliasBg };
          if (!bgBase || !acc) blank.push(key);
        }
      }
      [root.dataset.pal, root.dataset.mode, root.dataset.lang] = prev;
      probe.remove();
      // The aliases are dead if every palette resolves var(--bg) to the same colour.
      const distinct = new Set(Object.values(rows).map((r) => r.aliasBg));
      return {
        rows, blank,
        aliasTracksPalette: distinct.size > 1,
        ok: blank.length === 0 && distinct.size > 1,
      };
    })()`,

  // The settings swatch grid, which paints itself from the CSS at runtime.
  swatches: `
    (() => {
      if (typeof renderSwatches !== 'function') return { ok: false, why: 'renderSwatches missing' };
      renderSwatches();
      if (typeof renderModeControl === 'function') renderModeControl();
      const btns = [...document.querySelectorAll('.swatch-btn')];
      const transparent = btns.filter((b) => {
        const bg = getComputedStyle(b.querySelector('span')).backgroundColor;
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
      }).map((b) => b.dataset.slug);
      return {
        swatchCount: btns.length,
        modeButtons: document.querySelectorAll('.mode-btn').length,
        transparent,
        rootAfter: document.documentElement.dataset.pal + '/' + document.documentElement.dataset.mode,
        ok: btns.length === 14 && transparent.length === 0,
      };
    })()`,

  // Panels use the background shorthand, which accepts a gradient; background-color
  // would silently reject one. Checks a real rule rather than a synthetic property.
  panels: `
    (() => {
      const root = document.documentElement;
      const el = document.createElement('div');
      el.className = 'hero-tile';
      document.body.appendChild(el);
      const at = (pal, lang) => {
        root.dataset.pal = pal; root.dataset.mode = 'dark'; root.dataset.lang = lang;
        const cs = getComputedStyle(el);
        return { image: cs.backgroundImage.slice(0, 48), color: cs.backgroundColor };
      };
      const aether = at('steel', 'aether');
      const flat = at('nord', 'flat');
      el.remove();
      const painted = (r) => r.image !== 'none' || r.color !== 'rgba(0, 0, 0, 0)';
      return { aether, flat, ok: painted(aether) && painted(flat) };
    })()`,
};

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = requested.length ? requested : Object.keys(CHECKS);

const unknown = names.filter((n) => !CHECKS[n]);
if (unknown.length) {
  console.error(`unknown check(s): ${unknown.join(', ')}`);
  console.error(`available: ${Object.keys(CHECKS).join(', ')}`);
  process.exit(2);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900 });

  const netFailures = [];
  win.webContents.session.webRequest.onCompleted({ urls: ['file://*/*', '*://*/*'] }, (d) => {
    if (d.statusCode && d.statusCode >= 400) netFailures.push(`${d.statusCode} ${d.url}`);
  });

  try {
    await win.loadFile(INDEX);
  } catch (e) {
    console.error('failed to load index.html: ' + e.message);
    app.exit(2);
    return;
  }

  const results = {};
  for (const name of names) {
    try {
      results[name] = await win.webContents.executeJavaScript(CHECKS[name]);
    } catch (e) {
      results[name] = { ok: false, error: e.message };
    }
  }

  if (netFailures.length) results._networkFailures = netFailures;

  console.log(JSON.stringify(results, null, 2));

  const failed = names.filter((n) => results[n] && results[n].ok === false);
  if (failed.length) console.error(`\nFAILED: ${failed.join(', ')}`);
  // Non-zero on failure so this can gate a manual check without being read by eye.
  app.exit(failed.length || netFailures.length ? 1 : 0);
});
