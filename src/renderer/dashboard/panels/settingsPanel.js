// src/renderer/dashboard/panels/settingsPanel.js
// Settings popover: theme swatches, budget thresholds, panel toggles.
// Deliberately top-level classic script (no IIFE): onboarding.js and
// shortcuts.js call closeSettings/toggleSettings/selectPalette and read
// THEME_PALETTES as globals, and index.html boot calls mountSettings().

// Slug and display label only. 14 slugs, not 19: the spec's 19 counts palette
// VARIANTS - the five Aether slugs exist in both modes (5 x 2) plus nine single-mode
// legacy slugs. Mode is the segmented control below, so it must not also be a row here.
//
// Colours are deliberately absent. v1 re-declared each palette's --bg and --acc as JS
// literals with a comment admitting the CSS was the real source of truth; that is a
// second copy that can disagree with tokens.css and render a swatch misrepresenting
// the palette it selects. readSwatches() reads them from the CSS instead.
// test/settingsPalettes.test.js holds this list to themeConfig's KNOWN_PALETTES.
const THEME_PALETTE_LABELS = [
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

// The five palettes that carry the Aether visual language. Legacy palettes are flat.
// This mirrors themeConfig.AETHER_PALETTES; the same test pins them together.
const AETHER_SLUGS = ['cyan', 'azure', 'violet', 'emerald', 'steel'];

const DEFAULT_PALETTE = 'steel';
const DEFAULT_MODE = 'dark';

// lang is derived from the palette, never stored, so the two can never disagree.
function langFor(slug) {
  return AETHER_SLUGS.includes(slug) ? 'aether' : 'flat';
}

function currentPalette() {
  return document.documentElement.dataset.pal || DEFAULT_PALETTE;
}

function currentMode() {
  return document.documentElement.dataset.mode || DEFAULT_MODE;
}

// Read each palette's swatch colours from the CSS itself, so the grid can never
// disagree with tokens.css.
//
// The attribute MUST go on document.documentElement: tokens.css selectors are
// html[data-pal="..."], so a detached probe element matches nothing and every value
// comes back empty - which renders as a transparent chip that looks plausible against
// a dark panel. Mutating the live root in a loop is safe because the browser does not
// paint mid-task, and the attributes are restored before returning.
function readSwatches(slugs) {
  const root = document.documentElement;
  const prevPal = root.getAttribute('data-pal');
  const prevMode = root.getAttribute('data-mode');
  const out = {};
  for (const slug of slugs) {
    root.setAttribute('data-pal', slug);
    const cs = getComputedStyle(root);
    out[slug] = {
      bg: cs.getPropertyValue('--bg-base').trim(),
      acc: cs.getPropertyValue('--acc').trim(),
    };
  }
  // Restore before returning, or the app is left wearing the last palette read.
  if (prevPal) root.setAttribute('data-pal', prevPal); else root.removeAttribute('data-pal');
  if (prevMode) root.setAttribute('data-mode', prevMode); else root.removeAttribute('data-mode');
  return out;
}

// Populated by refreshSwatchColours(). onboarding.js reads this global to paint its
// own copy of the grid, so it keeps the { slug, label, bg, acc } shape v1 used.
let THEME_PALETTES = THEME_PALETTE_LABELS.map((p) => ({ ...p, bg: '', acc: '' }));

// The Aether palettes differ between light and dark, so the cached colours are only
// valid for the mode they were read in. Re-read on every mode change rather than
// caching once at mount, or the grid keeps showing dark chips in light mode.
let swatchColourMode = null;

function refreshSwatchColours() {
  const colours = readSwatches(THEME_PALETTE_LABELS.map((p) => p.slug));
  THEME_PALETTES = THEME_PALETTE_LABELS.map((p) => ({
    ...p,
    bg: colours[p.slug] ? colours[p.slug].bg : '',
    acc: colours[p.slug] ? colours[p.slug].acc : '',
  }));
  swatchColourMode = currentMode();
}

function ensureSwatchColours() {
  if (swatchColourMode !== currentMode()) refreshSwatchColours();
}

function renderSwatches() {
  const grid = document.getElementById('swatch-grid');
  if (!grid) return;
  ensureSwatchColours();
  const active = currentPalette();
  grid.innerHTML = THEME_PALETTES.map((p) => {
    const border = p.slug === active ? 'var(--acc)' : 'transparent';
    return `
      <button type="button" class="swatch-btn" data-slug="${escapeHtml(p.slug)}" title="${escapeHtml(p.label)}"
        style="display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent;border:none;padding:2px;cursor:pointer">
        <span style="width:34px;height:34px;border-radius:9px;background:${escapeHtml(p.bg)};border:2px solid ${border};display:flex;align-items:center;justify-content:center">
          <span style="width:12px;height:12px;border-radius:50%;background:${escapeHtml(p.acc)}"></span>
        </span>
        <span style="font:500 9px 'JetBrains Mono',monospace;color:var(--dim);white-space:nowrap">${escapeHtml(p.label)}</span>
      </button>`;
  }).join('');
}

// Applies palette + mode to the root and repaints everything that depends on them.
// lang is derived here rather than passed in, so it cannot be set inconsistently.
function applyTheme(slug, mode) {
  const root = document.documentElement;
  root.dataset.pal = slug;
  root.dataset.mode = mode;
  root.dataset.lang = langFor(slug);
  refreshSwatchColours(); // the palette or mode just changed, so the chips are stale
  renderSwatches();       // moves the active border to the new swatch
  renderModeControl();
  if (typeof window.TT === 'object' && window.TT.onboarding
      && typeof window.TT.onboarding.renderSwatches === 'function') {
    window.TT.onboarding.renderSwatches();
  }
  if (window.__ttTerm && typeof applyTerminalTheme === 'function') {
    applyTerminalTheme(window.__ttTerm);
  }
}

async function selectPalette(slug) {
  const mode = currentMode();
  applyTheme(slug, mode);
  // theme:set returns the resolved config, so an invalid slug reconciles rather than
  // leaving the UI showing a palette that was never persisted.
  const saved = await window.tokenTracker.theme.set({ theme: slug, mode });
  if (saved && saved.theme && saved.theme !== slug) applyTheme(saved.theme, saved.mode);
}

async function selectMode(mode) {
  const slug = currentPalette();
  applyTheme(slug, mode);
  await window.tokenTracker.theme.set({ theme: slug, mode });
}

// Light/dark segmented control. The nine legacy palettes are single-mode - tokens.css
// defines no light variant for them - so the control is disabled rather than left
// active and inert, which would read as a broken toggle.
function renderModeControl() {
  const box = document.getElementById('mode-seg');
  if (!box) return;
  const mode = currentMode();
  const isAether = AETHER_SLUGS.includes(currentPalette());
  box.title = isAether ? '' : 'This palette has a single fixed mode';
  box.innerHTML = ['dark', 'light'].map((m) => {
    const active = m === mode && isAether;
    return `
      <button type="button" class="mode-btn${active ? ' active' : ''}" data-mode="${escapeHtml(m)}"
        ${isAether ? '' : 'disabled'}
        style="flex:1;padding:4px 10px;border:none;border-radius:5px;cursor:${isAether ? 'pointer' : 'not-allowed'};
               font:500 10px 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;
               opacity:${isAether ? '1' : '.45'};
               background:${active ? 'var(--acc)' : 'transparent'};
               color:${active ? 'var(--acc-ink)' : 'var(--dim)'}">${escapeHtml(m)}</button>`;
  }).join('');
}

async function populateBudgetForm() {
  const budgets = await window.tokenTracker.budget.get();
  const form = document.getElementById('budget-form');
  form.innerHTML = ['session', 'day', 'week', 'month']
    .map(
      (period) => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <label for="budget-${period}" style="font:500 11px 'JetBrains Mono',monospace">${period[0].toUpperCase()}${period.slice(1)}</label>
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
  const modeSeg = document.getElementById('mode-seg');
  if (modeSeg) modeSeg.addEventListener('click', (e) => {
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
}
