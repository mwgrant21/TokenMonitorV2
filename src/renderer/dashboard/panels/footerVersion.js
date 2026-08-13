// src/renderer/dashboard/panels/footerVersion.js
// Footer version readout + "update available" chip, sourced from
// version:getStatus (src/main/versionStatus.js, computed on the existing
// 60s history-rescan tick in main - not a renderer poll). Two of the three
// states render no chip at all: silence is the reward for being current,
// and 'unknown' must never look like an error - the share being unreachable
// isn't the user's problem. Rollout stays manual by design, so the popover
// only ever says to contact IT - no download, no self-service install.
(function () {
  let status = null;

  function renderChip() {
    const chip = document.getElementById('footer-update-chip');
    if (!chip) return;
    chip.classList.remove('warning', 'critical');
    if (!status || status.state !== 'behind') {
      chip.style.display = 'none';
      chip.textContent = '';
      return;
    }
    chip.classList.add(status.behindBy === 'major' ? 'critical' : 'warning');
    chip.textContent = `UPDATE AVAILABLE · v${status.latest}`;
    chip.style.display = 'inline-block';
  }

  function renderPopover() {
    const current = document.getElementById('footer-version-pop-current');
    const meta = document.getElementById('footer-version-pop-meta');
    if (!current || !meta || !status) return;
    current.textContent = `Version · v${status.current}`;
    if (status.state === 'behind') {
      meta.textContent = `v${status.latest} is available. Contact IT to have it installed.`;
    } else if (status.state === 'current') {
      meta.textContent = 'Up to date.';
    } else {
      meta.textContent = 'Update status unknown - no fleet folder connected, or the share is unreachable.';
    }
  }

  function renderSettingsMirror() {
    const el = document.getElementById('settings-version-line');
    if (!el || !status) return;
    if (status.state === 'behind') el.textContent = `v${status.current} - v${status.latest} available, contact IT`;
    else if (status.state === 'current') el.textContent = `v${status.current} - up to date`;
    else el.textContent = `v${status.current}`;
  }

  async function refresh() {
    try {
      status = await window.tokenTracker.app.versionStatus();
    } catch (e) {
      status = null;
    }
    renderChip();
    renderPopover();
    renderSettingsMirror();
  }

  function openPopover() {
    document.getElementById('footer-version-backdrop').style.display = 'block';
    document.getElementById('footer-version-pop').style.display = 'block';
    refresh();
  }

  function closePopover() {
    document.getElementById('footer-version-backdrop').style.display = 'none';
    document.getElementById('footer-version-pop').style.display = 'none';
  }

  function togglePopover() {
    const pop = document.getElementById('footer-version-pop');
    if (pop.style.display === 'none' || pop.style.display === '') openPopover();
    else closePopover();
  }

  async function mount() {
    try {
      const v = await window.tokenTracker.app.version();
      document.getElementById('footer-version-btn').textContent = `v${v}`;
    } catch (e) { /* leave blank */ }
    document.getElementById('footer-version-btn').addEventListener('click', togglePopover);
    document.getElementById('footer-update-chip').addEventListener('click', togglePopover);
    document.getElementById('footer-version-backdrop').addEventListener('click', closePopover);
    await refresh();
  }

  window.TT.footerVersion = { mount };
})();
