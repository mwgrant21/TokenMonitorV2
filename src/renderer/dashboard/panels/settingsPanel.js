// src/renderer/dashboard/panels/settingsPanel.js
// Settings popover: theme swatches, budget thresholds, panel toggles.
// Deliberately top-level classic script (no IIFE): onboarding.js and
// shortcuts.js call closeSettings/toggleSettings/selectPalette and read
// THEME_PALETTES as globals, and index.html boot calls mountSettings().

// Theme palettes (slug, label, --bg, --acc) mirrored from the theme-picker spec
// table. Slugs MUST match dashboard.css [data-palette] blocks and themeConfig
// KNOWN_PALETTES. The CSS palette is the source of truth for the full color set;
// only --bg/--acc are duplicated here to paint the swatch chips.
const THEME_PALETTES = [
  { slug: 'midnight', label: 'Midnight', bg: '#0b0e14', acc: '#5b8cff' },
  { slug: 'slate', label: 'Slate', bg: '#12151b', acc: '#7f9cf5' },
  { slug: 'carbon', label: 'Carbon', bg: '#161616', acc: '#4589ff' },
  { slug: 'nord', label: 'Nord', bg: '#2e3440', acc: '#88c0d0' },
  { slug: 'onedark', label: 'One Dark', bg: '#21252b', acc: '#61afef' },
  { slug: 'solarized', label: 'Solarized', bg: '#002b36', acc: '#268bd2' },
  { slug: 'tokyonight', label: 'Tokyo Night', bg: '#1a1b26', acc: '#7aa2f7' },
  { slug: 'catppuccin', label: 'Catppuccin', bg: '#1e1e2e', acc: '#89b4fa' },
  { slug: 'github', label: 'GitHub', bg: '#0d1117', acc: '#2f81f7' },
  { slug: 'graphite', label: 'Graphite', bg: '#1c1c1e', acc: '#0a84ff' },
];

function renderSwatches() {
  const grid = document.getElementById('swatch-grid');
  if (!grid) return;
  const active = document.documentElement.dataset.palette || 'midnight';
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

async function selectPalette(slug) {
  document.documentElement.dataset.palette = slug;
  renderSwatches(); // moves the active border to the new swatch
  if (window.__ttTerm && typeof applyTerminalTheme === 'function') {
    applyTerminalTheme(window.__ttTerm);
  }
  await window.tokenTracker.theme.set({ theme: slug });
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
  document.getElementById('swatch-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch-btn');
    if (!btn) return;
    selectPalette(btn.dataset.slug);
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
