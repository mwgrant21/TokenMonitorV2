// src/renderer/dashboard/panels/footer.js
// App footer status strip: running version, fleet share path, seat count, alarm
// state. All four reuse existing data/IPC -- no new backend logic beyond the
// app:version handle (main.js/preload.js). Version is fetched once (it never
// changes at runtime); fleet path/seats are refreshed by fleet.js's existing
// poll loop (renderFleet), and alarm state is derived from dashboard:getState's
// existing `alerts` array (already sorted criticals-first by alertEngine.js) on
// every dashboard render fan-out.
//
// The version button also mirrors version:getStatus (src/main/versionStatus.js,
// computed on the existing 60s history-rescan tick in main). The renderer
// re-pulls it on a throttle piggybacked on the existing 1s dashboard:update
// fan-out (render(), below) rather than opening a second timer -- main's own
// value only changes once a minute, so anything faster would just be reading
// the same cached object. Without this the chip only ever reflected whatever
// was true at mount: a `latest.json` published (or removed) after the app was
// already open would never be noticed until restart, which defeats the
// feature in the app's normal always-open mode. Two of the three states
// render no chip at all: silence is the reward for being current, and
// 'unknown' must never look like an error - the share being unreachable
// isn't the user's problem. Rollout stays manual by design, so the popover
// only ever says to contact IT - no download, no self-service install.
(function () {
  let versionStatus = null;
  let lastVersionPoll = 0;
  const VERSION_POLL_INTERVAL_MS = 60_000;

  function alarmFromAlerts(alerts) {
    if (!alerts || !alerts.length) return { label: 'NOMINAL', cls: '' };
    return alerts[0].severity === 'critical'
      ? { label: 'CRITICAL', cls: 'crit' }
      : { label: 'WARNING', cls: 'warn' };
  }

  function renderVersion() {
    const el = document.getElementById('footer-version');
    if (!el || !window.tokenTracker || !window.tokenTracker.app) return;
    window.tokenTracker.app.getVersion()
      .then((v) => { el.textContent = `v${v}`; })
      .catch(() => {});
  }

  function renderUpdateChip() {
    const chip = document.getElementById('footer-update-chip');
    if (!chip) return;
    chip.classList.remove('warning', 'critical');
    if (!versionStatus || versionStatus.state !== 'behind') {
      chip.style.display = 'none';
      chip.textContent = '';
      return;
    }
    chip.classList.add(versionStatus.behindBy === 'major' ? 'critical' : 'warning');
    chip.textContent = `UPDATE AVAILABLE · v${versionStatus.latest}`;
    chip.style.display = 'inline-block';
  }

  function renderVersionPopover() {
    const current = document.getElementById('footer-version-pop-current');
    const meta = document.getElementById('footer-version-pop-meta');
    if (!current || !meta) return;
    // A failed versionStatus() call (or one still in flight) must not leave
    // the popover showing two empty boxes -- fall back to the same "unknown"
    // copy used for a genuinely unreachable share, since from the user's
    // side the two are indistinguishable anyway.
    const btn = document.getElementById('footer-version');
    const knownVersion = versionStatus ? versionStatus.current : (btn && btn.textContent !== 'v…' ? btn.textContent.replace(/^v/, '') : null);
    current.textContent = knownVersion ? `Version · v${knownVersion}` : 'Version';
    if (!versionStatus) {
      meta.textContent = 'Update status unknown — no fleet folder connected, or the share is unreachable.';
    } else if (versionStatus.state === 'behind') {
      meta.textContent = `v${versionStatus.latest} is available. Contact IT to have it installed.`;
    } else if (versionStatus.state === 'current') {
      meta.textContent = 'Up to date.';
    } else {
      meta.textContent = 'Update status unknown — no fleet folder connected, or the share is unreachable.';
    }
  }

  function renderSettingsVersionMirror() {
    const el = document.getElementById('settings-version-status');
    if (!el) return;
    if (!versionStatus || versionStatus.state === 'unknown') el.textContent = '';
    else if (versionStatus.state === 'behind') el.textContent = `v${versionStatus.latest} available, contact IT`;
    else el.textContent = 'up to date';
  }

  async function refreshVersionStatus() {
    if (!window.tokenTracker || !window.tokenTracker.app) return;
    try {
      versionStatus = await window.tokenTracker.app.versionStatus();
    } catch (e) {
      versionStatus = null;
    }
    renderUpdateChip();
    renderVersionPopover();
    renderSettingsVersionMirror();
  }

  function openVersionPopover() {
    document.getElementById('footer-version-backdrop').style.display = 'block';
    document.getElementById('footer-version-pop').style.display = 'block';
    refreshVersionStatus();
  }

  function closeVersionPopover() {
    document.getElementById('footer-version-backdrop').style.display = 'none';
    document.getElementById('footer-version-pop').style.display = 'none';
  }

  function toggleVersionPopover() {
    const pop = document.getElementById('footer-version-pop');
    if (pop.style.display === 'none' || pop.style.display === '') openVersionPopover();
    else closeVersionPopover();
  }

  function mountVersionCheck() {
    const btn = document.getElementById('footer-version');
    const chip = document.getElementById('footer-update-chip');
    const backdrop = document.getElementById('footer-version-backdrop');
    if (!btn || !chip || !backdrop) return;
    btn.addEventListener('click', toggleVersionPopover);
    chip.addEventListener('click', toggleVersionPopover);
    backdrop.addEventListener('click', closeVersionPopover);
    refreshVersionStatus();
  }

  function render(state) {
    const el = document.getElementById('footer-alarm');
    if (el) {
      const { label, cls } = alarmFromAlerts(state && state.alerts);
      el.textContent = label;
      el.className = `footer-alarm${cls ? ` ${cls}` : ''}`;
    }
    // Piggyback the version-status re-poll on this existing 1s fan-out rather
    // than opening a second timer. Throttled to match main's own refresh
    // cadence -- main's cache only changes once a minute, so polling faster
    // would just re-read the same object.
    const now = Date.now();
    if (now - lastVersionPoll >= VERSION_POLL_INTERVAL_MS) {
      lastVersionPoll = now;
      refreshVersionStatus();
    }
  }

  // Called by fleet.js's refreshFleetView (same poll cycle that already
  // updates the header's #seats-chip) -- no separate footer polling.
  function renderFleet(fleetState) {
    const pathEl = document.getElementById('footer-fleet-path');
    const seatsEl = document.getElementById('footer-seats');
    if (pathEl) {
      pathEl.textContent = fleetState && fleetState.folder ? fleetState.folder : 'fleet: not connected';
    }
    if (seatsEl) {
      seatsEl.textContent = fleetState && fleetState.connected && fleetState.chip
        ? `${fleetState.chip.reporting}/${fleetState.chip.total} seats`
        : '';
    }
  }

  function mount() {
    renderVersion();
    mountVersionCheck();
  }

  window.TT = window.TT || {};
  window.TT.footer = { mount, render, renderFleet, refreshVersionStatus };
})();
