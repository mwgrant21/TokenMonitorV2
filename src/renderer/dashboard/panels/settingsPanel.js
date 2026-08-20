// src/renderer/dashboard/panels/settingsPanel.js
// Settings popover: theme swatches, light/dark mode, budget thresholds, panel toggles.
// Deliberately top-level classic script (no IIFE): onboarding.js and
// shortcuts.js call closeSettings/toggleSettings/selectPalette and read
// THEME_PALETTES as globals, and index.html boot calls mountSettings().

// Aether palette slugs render in the "aether" visual language; every other slug
// renders in "flat". Mirrors deriveLang() in src/shared/themeConfig.js.
const AETHER_SLUGS = ['cyan', 'azure', 'violet', 'emerald', 'steel'];

// The fourteen palette identifiers, in display order, with their labels ONLY.
// No colour is duplicated here: readSwatches() reads --bg-base/--acc straight out
// of tokens.css at runtime, so the grid can never drift from the stylesheet.
// The slug list mirrors KNOWN_PALETTES in src/shared/themeConfig.js - renderer
// scripts are classic <script>s and cannot require() it, so
// test/settingsPalettes.test.js asserts the two stay identical (same order).
const THEME_PALETTES = [
  { slug: 'cyan', label: 'Cyan' },
  { slug: 'azure', label: 'Azure' },
  { slug: 'violet', label: 'Violet' },
  { slug: 'emerald', label: 'Emerald' },
  { slug: 'steel', label: 'Steel' },
  { slug: 'midnight', label: 'Midnight' },
  { slug: 'slate', label: 'Slate' },
  { slug: 'carbon', label: 'Carbon' },
  { slug: 'nord', label: 'Nord' },
  { slug: 'onedark', label: 'One Dark' },
  { slug: 'solarized', label: 'Solarized' },
  { slug: 'catppuccin', label: 'Catppuccin' },
  { slug: 'github', label: 'GitHub' },
  { slug: 'graphite', label: 'Graphite' },
];

const THEME_MODES = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
];

// Defaults mirror DEFAULT_THEME/DEFAULT_MODE in src/shared/themeConfig.js.
const DEFAULT_PALETTE = 'steel';
const DEFAULT_MODE = 'dark';

function currentPalette() {
  return document.documentElement.dataset.pal || DEFAULT_PALETTE;
}
function currentMode() {
  return document.documentElement.dataset.mode || DEFAULT_MODE;
}
function langForPalette(slug) {
  return AETHER_SLUGS.includes(slug) ? 'aether' : 'flat';
}

// Read each palette's swatch colours from the CSS itself, so the grid can never
// disagree with tokens.css. Cached per mode by swatchColors() - never per render.
//
// The attribute must go on document.documentElement: tokens.css's selectors are
// html[data-pal="..."], so a detached probe element matches nothing and every
// value comes back empty (a quiet failure - the chips render, just colourless).
// Reading in a loop is safe despite mutating the live root: the browser does not
// paint mid-task, and the attributes are restored before the function returns.
// data-lang is deliberately not touched - neither --bg-base nor --acc is declared
// in tokens.css's [data-lang] block, so these two reads are language-independent.
function readSwatches(slugs, mode) {
  const root = document.documentElement;
  const prevPal = root.getAttribute('data-pal');
  const prevMode = root.getAttribute('data-mode');
  const out = {};
  for (const slug of slugs) {
    root.setAttribute('data-pal', slug);
    root.setAttribute('data-mode', mode);
    const cs = getComputedStyle(root);
    out[slug] = { bg: cs.getPropertyValue('--bg-base').trim(),
                  acc: cs.getPropertyValue('--acc').trim() };
  }
  // Restore before returning, or the app is left wearing the last palette read.
  if (prevPal) root.setAttribute('data-pal', prevPal); else root.removeAttribute('data-pal');
  if (prevMode) root.setAttribute('data-mode', prevMode); else root.removeAttribute('data-mode');
  return out;
}

// Cached per mode: the five Aether palettes have distinct light/dark swatch
// colours, so the cache is keyed by mode rather than computed once globally.
const SWATCH_CACHE = {};
function swatchColors(mode) {
  if (!SWATCH_CACHE[mode]) {
    SWATCH_CACHE[mode] = readSwatches(THEME_PALETTES.map((p) => p.slug), mode);
  }
  return SWATCH_CACHE[mode];
}

// One chip per palette identifier (14), not per tokens.css selector block (19):
// light/dark is an orthogonal axis owned by the mode control below, so the five
// Aether palettes get one chip each that re-reads its colours when mode changes.
function swatchButtonHtml(p, active, colors) {
  const c = colors[p.slug] || {};
  const border = p.slug === active ? 'var(--acc)' : 'transparent';
  return `
      <button type="button" class="swatch-btn" data-slug="${escapeHtml(p.slug)}" title="${escapeHtml(p.label)}"
        style="display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent;border:none;padding:2px;cursor:pointer">
        <span style="width:34px;height:34px;border-radius:9px;background:${escapeHtml(c.bg || 'transparent')};border:2px solid ${border};display:flex;align-items:center;justify-content:center">
          <span style="width:12px;height:12px;border-radius:50%;background:${escapeHtml(c.acc || 'transparent')}"></span>
        </span>
        <span style="font:500 9px var(--f-mono);color:var(--dim);white-space:nowrap">${escapeHtml(p.label)}</span>
      </button>`;
}

function renderSwatches() {
  const grid = document.getElementById('swatch-grid');
  if (!grid) return;
  const active = currentPalette();
  const colors = swatchColors(currentMode());
  grid.innerHTML = THEME_PALETTES.map((p) => swatchButtonHtml(p, active, colors)).join('');
}

// The nine legacy palettes are declared in tokens.css without a [data-mode]
// qualifier, so they render identically in both modes. Rather than let the
// control look broken, it is disabled (and says why) while one is active.
//
// The highlighted segment shows the mode actually being RENDERED, not the one
// stored: a legacy palette always renders dark, whatever mode is on disk. The
// stored mode is deliberately left untouched so it comes back the moment an
// Aether palette is picked again - only the highlight is suppressed, so the
// control can never assert a state the app is not in.
function renderModeControl() {
  const seg = document.getElementById('mode-seg');
  if (!seg) return;
  const flat = langForPalette(currentPalette()) === 'flat';
  const shown = flat ? 'dark' : currentMode();
  const why = flat
    ? 'Light mode applies to the Aether palettes only'
    : 'Switch between light and dark';
  seg.classList.toggle('disabled', flat);
  seg.innerHTML = THEME_MODES.map((m) => `
      <button type="button" class="mode-btn${m.mode === shown ? ' active' : ''}" data-mode="${escapeHtml(m.mode)}"
        title="${escapeHtml(why)}"${flat ? ' disabled' : ''}>${escapeHtml(m.label)}</button>`).join('');
}

// Single writer for the three root attributes tokens.css keys off. data-lang is
// derived from the palette (never stored separately) so a legacy palette can
// never disagree with the flat visual language it needs.
function applyTheme(slug, mode) {
  const root = document.documentElement;
  root.dataset.pal = slug;
  root.dataset.mode = mode;
  root.dataset.lang = langForPalette(slug);
}

async function persistTheme(slug, mode) {
  renderSwatches();      // moves the active border, and re-reads Aether chips per mode
  renderModeControl();
  if (window.__ttTerm && typeof applyTerminalTheme === 'function') {
    applyTerminalTheme(window.__ttTerm);
  }
  await window.tokenTracker.theme.set({ theme: slug, mode });
}

// Changing the palette must not reset the mode (and vice versa) - both are read
// back off the root, so whichever axis the user did not touch is carried through.
async function selectPalette(slug) {
  const mode = currentMode();
  applyTheme(slug, mode);
  await persistTheme(slug, mode);
}

async function selectMode(mode) {
  const slug = currentPalette();
  applyTheme(slug, mode);
  await persistTheme(slug, mode);
}

async function populateBudgetForm() {
  const budgets = await window.tokenTracker.budget.get();
  const form = document.getElementById('budget-form');
  form.innerHTML = ['session', 'day', 'week', 'month']
    .map(
      (period) => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <label for="budget-${period}" style="font:500 11px var(--f-mono)">${period[0].toUpperCase()}${period.slice(1)}</label>
        <input id="budget-${period}" type="number" value="${budgets[period].tokens}" min="1" style="width:140px">
      </div>`
    )
    .join('');
}

// Alerts & thresholds section. Step sizes mirror onboarding's TH_STEPS;
// clamps come from the alerts:ranges IPC so UI and persistence agree.
const SETTINGS_TH_STEPS = { thBudget: 5, thBurn: 0.5, thWaste: 5, thAgent: 25 };
let settingsThRanges = null;
let settingsAlerts = null;

async function refreshAlertsSection() {
  settingsAlerts = await window.tokenTracker.alerts.get();
  const toggle = document.getElementById('alerts-enabled-toggle');
  if (toggle) toggle.checked = settingsAlerts.enabled;
  for (const key of ['thBudget', 'thBurn', 'thWaste', 'thAgent']) {
    const el = document.getElementById(`th-${key}`);
    if (el) el.textContent = settingsAlerts[key];
  }
}

// Persist a partial, then pull fresh state so the banner re-filters live
// (the 1s push would catch it anyway; this makes it immediate).
async function saveAlertsPartial(partial) {
  try {
    settingsAlerts = await window.tokenTracker.alerts.set(partial);
    const state = await window.tokenTracker.dashboard.getState();
    if (window.TT.renderDashboard) window.TT.renderDashboard(state);
  } catch (e) {
    // Persist failed; re-sync controls from the persisted config so the
    // toggle/thresholds don't stay visually out of step with reality.
    await refreshAlertsSection();
  }
}

function mountAlertsSection() {
  window.tokenTracker.alerts.ranges().then((r) => { settingsThRanges = r; }).catch(() => {});
  const toggle = document.getElementById('alerts-enabled-toggle');
  if (toggle) toggle.addEventListener('change', () => saveAlertsPartial({ enabled: toggle.checked }));
  const box = document.getElementById('alerts-thresholds');
  if (box) box.addEventListener('click', async (e) => {
    const btn = e.target.closest('.th-btn');
    if (!btn || !settingsAlerts) return;
    const key = btn.dataset.key;
    const dir = Number(btn.dataset.dir);
    let v = Math.round((settingsAlerts[key] + dir * SETTINGS_TH_STEPS[key]) * 10) / 10;
    if (settingsThRanges && settingsThRanges[key]) {
      const [min, max] = settingsThRanges[key];
      if (v < min) v = min;
      if (v > max) v = max;
    }
    await saveAlertsPartial({ [key]: v });
    const el = document.getElementById(`th-${key}`);
    if (el) el.textContent = settingsAlerts[key];
  });
}

// Fetched once at mount -- the running version never changes within a session.
async function renderSettingsVersion() {
  const el = document.getElementById('settings-version');
  if (!el || !window.tokenTracker || !window.tokenTracker.app) return;
  try {
    el.textContent = await window.tokenTracker.app.getVersion();
  } catch (e) {
    /* leave the placeholder */
  }
}

async function openSettings() {
  await populateBudgetForm();
  await refreshAlertsSection();
  renderSwatches();
  renderModeControl();
  document.getElementById('settings-backdrop').style.display = 'block';
  document.getElementById('settings-popover').style.display = 'block';
}

function closeSettings() {
  document.getElementById('settings-backdrop').style.display = 'none';
  document.getElementById('settings-popover').style.display = 'none';
}

function toggleSettings() {
  const backdrop = document.getElementById('settings-backdrop');
  if (backdrop.style.display === 'none' || backdrop.style.display === '') {
    openSettings();
  } else {
    closeSettings();
  }
}

async function saveBudgetSettings() {
  const current = await window.tokenTracker.budget.get();
  const budgets = {};
  for (const period of ['session', 'day', 'week', 'month']) {
    const n = Number(document.getElementById(`budget-${period}`).value);
    budgets[period] = { tokens: Number.isFinite(n) && n >= 1 ? n : current[period].tokens };
  }
  await window.tokenTracker.budget.set(budgets);
  closeSettings();
}

function setPanelVisible(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

async function persistPanels() {
  await window.tokenTracker.panels.set({
    showOptimize: document.getElementById('toggle-optimize').checked,
    showTreemap: document.getElementById('toggle-treemap').checked,
  });
}

function mountSettings() {
  renderSwatches();
  renderModeControl();
  document.getElementById('swatch-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch-btn');
    if (!btn) return;
    selectPalette(btn.dataset.slug);
  });
  document.getElementById('mode-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn || btn.disabled) return;
    selectMode(btn.dataset.mode);
  });
  document.getElementById('settings-btn').addEventListener('click', toggleSettings);
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('settings-backdrop').addEventListener('click', closeSettings);
  document.getElementById('budget-save-btn').addEventListener('click', saveBudgetSettings);

  const optToggle = document.getElementById('toggle-optimize');
  const treeToggle = document.getElementById('toggle-treemap');
  optToggle.addEventListener('change', () => {
    setPanelVisible('optimize-panel', optToggle.checked);
    persistPanels();
  });
  treeToggle.addEventListener('change', () => {
    setPanelVisible('treemap-panel', treeToggle.checked);
    persistPanels();
  });

  // On load, apply persisted panel visibility (optimize on, treemap off by default).
  (async () => {
    let showOptimize = true;
    let showTreemap = false;
    try {
      const p = await window.tokenTracker.panels.get();
      if (p && typeof p.showOptimize === 'boolean') showOptimize = p.showOptimize;
      if (p && typeof p.showTreemap === 'boolean') showTreemap = p.showTreemap;
    } catch (e) {
      /* keep defaults */
    }
    optToggle.checked = showOptimize;
    treeToggle.checked = showTreemap;
    setPanelVisible('optimize-panel', showOptimize);
    setPanelVisible('treemap-panel', showTreemap);
  })();

  mountAlertsSection();
  renderSettingsVersion();
}
