// src/renderer/dashboard/panels/optimize.js
(function () {
  let latestState = null; // replaces __ttLatestState
  let applyFinding = null; // replaces __ttApplyFinding
  let breakdownOpen = false;

  const GLYPH = { good: '\u25CF', warn: '\u25B2', bad: '\u2715' };

  function breakdownHtml(state) {
    const allRows = state.optimizeBreakdown || [];
    const rows = allRows
      .map(
        (r, i) => `
        ${!r.scored && (i === 0 || allRows[i - 1].scored) ? '<div class="optimize-bd-divider"></div>' : ''}
        <div class="optimize-bd-row">
          <span class="optimize-bd-glyph ${r.status}">${GLYPH[r.status] || ''}</span>
          <span class="optimize-bd-label">${escapeHtml(r.label)}${r.scored ? '' : ' <span class="optimize-bd-unscored">(informational, not scored)</span>'}</span>
          <span class="optimize-bd-note">${escapeHtml(r.note)}</span>
        </div>`
      )
      .join('');
    const n = Math.round((state.optimizeSummary && state.optimizeSummary.totalPerWeek) || 0);
    return `
      <div class="optimize-breakdown" id="optimize-breakdown">
        ${rows}
        <div class="optimize-bd-prompt">Apply the flagged fixes above to reclaim ~$${n}/wk and reach an A. Setup grade is based on model routing, file pinning and output caps only - context hygiene doesn't factor in.</div>
      </div>`;
  }

  function renderOptimize(state) {
    const el = document.getElementById('optimize-panel');
    if (!el) return;
    const summary = state.optimizeSummary || { totalPerWeek: 0, grade: 'A' };
    const findings = state.optimizeFindings || [];
    const appliedSum = state.optimizeApplied || { count: 0, totalPerWeek: 0 };
    const n = Math.round(summary.totalPerWeek || 0);
    const summaryText =
      appliedSum.count > 0
        ? `${appliedSum.count} applied \u00B7 saving ~$${Math.round(appliedSum.totalPerWeek)}/wk`
        : `est. save ~$${n}/wk`;
    const header = `
      <div class="optimize-header">
        <div class="optimize-title">&#9889; Optimize - ${escapeHtml(summaryText)}</div>
        <button type="button" class="optimize-grade" id="optimize-grade-btn" title="Setup grade breakdown">Setup ${escapeHtml(summary.grade)} &#9662;</button>
      </div>
      ${breakdownOpen ? breakdownHtml(state) : ''}`;
    if (!findings.length) {
      el.innerHTML = `${header}<div class="optimize-empty">Looking healthy - no findings.</div>`;
      return;
    }
    const cards = findings
      .map(
        (f) => `
        <div class="optimize-card${f.recurring ? ' recurring' : ''}">
          <div class="optimize-card-title">${escapeHtml(f.title)}</div>
          <div class="optimize-card-detail">${escapeHtml(f.detail)}</div>
          ${
            // A finding only ever reaches this list while still active (the main
            // process drops resolved ones), so "applied" here always means the
            // guidance didn't stick -- always offer Reapply, never a dead-end
            // checkmark with no way back to Apply.
            f.recurring
              ? `<div class="optimize-recurring" title="Guidance exists but this kept happening anyway - reapplying resets the check">&#9888; Still happening despite guidance \u00B7 ~$${Math.round(f.estSavingsPerWeek || 0)}/wk</div>
          <button type="button" class="optimize-apply" data-id="${escapeHtml(f.id)}" data-title="${escapeHtml(f.title)}">Reapply fix</button>`
              : `<div class="optimize-card-save">~$${Math.round(f.estSavingsPerWeek || 0)}/wk</div>
          <button type="button" class="optimize-apply" data-id="${escapeHtml(f.id)}" data-title="${escapeHtml(f.title)}">Apply fix</button>`
          }
        </div>`
      )
      .join('');
    el.innerHTML = `${header}<div class="optimize-grid">${cards}</div>`;
  }

  function guidanceForFinding(findingId) {
    const findings = (latestState && latestState.optimizeFindings) || [];
    const f = findings.find((x) => x.id === findingId);
    return f && f.guidance ? f.guidance : null;
  }

  function closeOptimizeApply() {
    const backdrop = document.getElementById('optimize-apply-backdrop');
    const modal = document.getElementById('optimize-apply-modal');
    if (backdrop) backdrop.style.display = 'none';
    if (modal) modal.style.display = 'none';
    applyFinding = null;
  }

  async function openOptimizeApply(findingId, title) {
    const guidance = guidanceForFinding(findingId);
    applyFinding = { id: findingId, title, guidance };

    const titleEl = document.getElementById('optimize-apply-finding-title');
    const guidanceEl = document.getElementById('optimize-apply-guidance');
    const statusEl = document.getElementById('optimize-apply-status');
    const globalLabel = document.getElementById('optimize-apply-global-label');
    const projectLabel = document.getElementById('optimize-apply-project-label');
    const globalRadio = document.getElementById('optimize-apply-target-global');
    const projectRadio = document.getElementById('optimize-apply-target-project');

    if (titleEl) titleEl.textContent = title || '';
    if (guidanceEl) guidanceEl.textContent = guidance || '(no guidance available for this finding)';
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'optimize-apply-status';
    }

    // Reset the target selector to a loading state before targets resolve.
    if (globalRadio) {
      globalRadio.value = '';
      globalRadio.checked = false;
      globalRadio.disabled = true;
    }
    if (projectRadio) {
      projectRadio.value = '';
      projectRadio.checked = false;
      projectRadio.disabled = true;
    }
    if (globalLabel) globalLabel.textContent = 'loading...';
    if (projectLabel) projectLabel.textContent = 'loading...';

    const backdrop = document.getElementById('optimize-apply-backdrop');
    const modal = document.getElementById('optimize-apply-modal');
    if (backdrop) backdrop.style.display = 'block';
    if (modal) modal.style.display = 'block';

    try {
      const targets = await window.tokenTracker.optimize.targets();
      // Global is always present.
      if (targets && targets.global) {
        if (globalRadio) {
          globalRadio.value = targets.global.path;
          globalRadio.disabled = false;
          globalRadio.checked = true;
        }
        if (globalLabel) globalLabel.textContent = targets.global.path;
      }
      // Project may be null when no active project is detected.
      if (targets && targets.project) {
        if (projectRadio) {
          projectRadio.value = targets.project.path;
          projectRadio.disabled = false;
        }
        if (projectLabel) projectLabel.textContent = targets.project.path;
      } else {
        if (projectRadio) {
          projectRadio.value = '';
          projectRadio.disabled = true;
          projectRadio.checked = false;
        }
        if (projectLabel) projectLabel.textContent = 'no active project detected';
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = 'Could not load targets.';
        statusEl.className = 'optimize-apply-status error';
      }
    }
  }

  async function confirmOptimizeApply() {
    const statusEl = document.getElementById('optimize-apply-status');
    const applyBtn = document.getElementById('optimize-apply-confirm-btn');
    if (!applyFinding) return;

    const globalRadio = document.getElementById('optimize-apply-target-global');
    const projectRadio = document.getElementById('optimize-apply-target-project');
    const selected =
      projectRadio && projectRadio.checked && !projectRadio.disabled
        ? projectRadio
        : globalRadio;
    const targetPath = selected ? selected.value : '';

    if (!targetPath) {
      if (statusEl) {
        statusEl.textContent = 'Select a target first.';
        statusEl.className = 'optimize-apply-status error';
      }
      return;
    }

    if (applyBtn) applyBtn.disabled = true;
    if (statusEl) {
      statusEl.textContent = 'Applying...';
      statusEl.className = 'optimize-apply-status';
    }

    try {
      const res = await window.tokenTracker.optimize.apply({
        findingId: applyFinding.id,
        targetPath,
      });
      if (res && res.ok) {
        const base = String(res.targetPath || targetPath).split(/[\\/]/).pop();
        if (res.added) {
          if (statusEl) {
            statusEl.textContent = `Applied to ${base} (backed up)`;
            statusEl.className = 'optimize-apply-status ok';
          }
        } else {
          if (statusEl) {
            statusEl.textContent = 'Already applied';
            statusEl.className = 'optimize-apply-status ok';
          }
        }
        setTimeout(closeOptimizeApply, 900);
      } else {
        const msg = (res && res.error) || 'Apply failed';
        if (statusEl) {
          statusEl.textContent = msg;
          statusEl.className = 'optimize-apply-status error';
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = (err && err.message) || 'Apply failed';
        statusEl.className = 'optimize-apply-status error';
      }
    } finally {
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  function render(state) {
    latestState = state;
    renderOptimize(state);
  }

  // Wires the Apply-fix dialog buttons + the delegated card-button handler.
  // Called once from dashboard.js mountDashboard().
  function mountApplyDialog() {
    const optPanel = document.getElementById('optimize-panel');
    if (optPanel) {
      optPanel.addEventListener('click', (e) => {
        const gradeBtn = e.target.closest('#optimize-grade-btn');
        if (gradeBtn) {
          breakdownOpen = !breakdownOpen;
          if (latestState) renderOptimize(latestState);
          return;
        }
        const btn = e.target.closest('.optimize-apply');
        if (!btn) return;
        openOptimizeApply(btn.dataset.id, btn.dataset.title);
      });
    }
    const applyBackdrop = document.getElementById('optimize-apply-backdrop');
    const applyCancel = document.getElementById('optimize-apply-cancel-btn');
    const applyClose = document.getElementById('optimize-apply-close-btn');
    const applyConfirm = document.getElementById('optimize-apply-confirm-btn');
    if (applyBackdrop) applyBackdrop.addEventListener('click', closeOptimizeApply);
    if (applyCancel) applyCancel.addEventListener('click', closeOptimizeApply);
    if (applyClose) applyClose.addEventListener('click', closeOptimizeApply);
    if (applyConfirm) applyConfirm.addEventListener('click', confirmOptimizeApply);
  }

  window.TT.optimize = { render, openApply: openOptimizeApply, mountApplyDialog };
})();
