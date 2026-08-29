// src/renderer/fleet/fleet.js
//
// Deviation from the plan: the plan used `export function mountFleet` inside
// a `<script type="module">`. This renderer loads scripts as plain classic
// <script> tags (see terminal.js/dashboard.js), so this exposes `mountFleet`
// on the global scope instead of using import/export. Function bodies
// otherwise match the plan verbatim, plus a local escapeHtml helper (Task 15's
// dashboard.js has its own file-local copy; seat.username here comes from
// other machines' snapshot files, so it needs the same escaping).

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmptyState() {
  const el = document.getElementById('fleet-pane');
  el.innerHTML = `
    <div class="fleet-empty">
      <h2>Team Fleet - Not Connected</h2>
      <p style="color:var(--dim)">Point this at the shared usage folder to see the team roll-up.</p>
      <button class="fleet-connect-btn" id="fleet-connect-btn">Connect</button>
    </div>`;
  document.getElementById('fleet-connect-btn').addEventListener('click', async () => {
    const folderPath = await window.tokenTracker.fleet.pickFolder();
    if (!folderPath) return;
    await window.tokenTracker.fleet.connect(folderPath);
    refreshFleetView();
  });
}

let lastRefreshedAt = null;

function fmtMoney(n) {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function fmtAgo(ts) {
  if (!ts) return 'just now';
  const mins = Math.round((Date.now() - ts) / 60000);
  return mins <= 0 ? 'just now' : `${mins} min ago`;
}

function updateSeatsChip(state) {
  const chip = document.getElementById('seats-chip');
  if (!chip) return;
  if (!state.connected || !state.chip) { chip.textContent = 'not connected'; return; }
  const c = state.chip;
  chip.textContent = `${c.reporting}/${c.total} seats \u00b7 ${c.active} active`;
}

function renderToolbar() {
  return `
    <div class="fleet-toolbar">
      <div class="fleet-toolbar-title">Team roll-up</div>
    </div>`;
}

function renderTotals(state) {
  const t = state.totals || { spend: 0, avgCacheHitRate: null, avgOneShotRate: null, reporting: 0 };
  const pct = (v) => (v == null ? '--' : `${Math.round(v * 100)}%`);
  return `
    <div class="fleet-totals">
      <span>Dept spend \u00b7 wk <b>${fmtMoney(t.spend)}</b></span>
      <span>Avg cache <b>${pct(t.avgCacheHitRate)}</b></span>
      <span>Avg 1-shot <b>${pct(t.avgOneShotRate)}</b></span>
      <span>${t.reporting} reporting</span>
      ${renderVersionChip(state)}
    </div>`;
}

// Silence when the fleet agrees with itself: a chip that is always present stops being
// read. It appears only when seats actually disagree, and counts only seats we can
// place -- 'unknown' seats are reported separately rather than folded into a
// behind-count they might not belong in.
function renderVersionChip(state) {
  const v = state.versions;
  if (!v || (!v.behind && !v.unknown)) return '';
  const parts = [];
  if (v.behind) parts.push(`${v.behind} seat${v.behind === 1 ? '' : 's'} behind`);
  if (v.unknown) parts.push(`${v.unknown} unknown`);
  return `<span class="fleet-version-chip${v.behind ? ' behind' : ''}">${parts.join(' · ')}</span>`;
}

// A seat's version cell. A snapshot written before seats reported a version has no
// appVersion at all, and buildInfo reports 'unknown' on a dev run -- both render as
// 'unknown' rather than as a number, because a plausible-looking version for a seat we
// cannot identify is worse than an obvious gap.
function seatVersionCell(seat, newest) {
  const raw = seat && seat.appVersion;
  const version = typeof raw === 'string' && raw && raw !== 'unknown' ? raw : null;
  if (!version) return '<td class="seat-version unknown">unknown</td>';
  const behind = newest && version !== newest;
  return `<td class="seat-version${behind ? ' behind' : ''}">${escapeHtml(version)}</td>`;
}

function renderSeats(state) {
  const newest = state.versions ? state.versions.newest : null;
  const rows = (state.seats || [])
    .map(
      (seat) => `
      <tr class="${seat.stale ? 'stale' : ''}">
        <td>${escapeHtml(seat.username)}</td>
        ${seatVersionCell(seat, newest)}
        <td>${fmtMoney(seat.spend)}</td>
        <td>${Math.round((seat.cacheHitRate || 0) * 100)}%</td>
        <td>${seat.oneShotRate == null ? '--' : Math.round(seat.oneShotRate * 100) + '%'}</td>
        <td>${seat.runningAgents || 0}</td>
        <td>${seat.stale ? 'not reporting' : 'active'}</td>
      </tr>`
    )
    .join('');
  return `
    <table class="fleet-table">
      <thead><tr><th>Engineer</th><th>Version</th><th>Spend</th><th>Cache</th><th>1-shot</th><th>Agents</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderWaste(state) {
  const waste = state.waste || [];
  const total = waste.reduce((s, w) => s + w.totalPerWeek, 0);
  if (!waste.length) {
    return '<div class="fleet-waste"><div class="fleet-waste-title">&#9889; Team-wide waste</div><div class="fleet-waste-empty">Looking healthy - no findings across reporting seats.</div></div>';
  }
  const cards = waste
    .map(
      (w) => `
      <div class="fleet-waste-card">
        <div class="fleet-waste-card-title">${escapeHtml(w.title)}</div>
        <div class="fleet-waste-card-detail">${w.seatCount} seat${w.seatCount === 1 ? '' : 's'} \u00b7 ~${fmtMoney(w.totalPerWeek)}/wk</div>
      </div>`
    )
    .join('');
  return `
    <div class="fleet-waste">
      <div class="fleet-waste-title">&#9889; Team-wide waste \u00b7 reclaim ~${fmtMoney(total)}/wk</div>
      <div class="fleet-waste-grid">${cards}</div>
    </div>`;
}

function renderFooter(state) {
  return `
    <div class="fleet-footer">
      &#10515; reading from ${escapeHtml(state.folder || '?')} \u00b7 refreshed ${fmtAgo(lastRefreshedAt)} \u00b7
      <a href="#" id="fleet-change-folder">change folder</a>
    </div>`;
}

function renderConnected(state) {
  const el = document.getElementById('fleet-pane');
  el.innerHTML = `
    <div class="fleet-body">
      ${renderToolbar()}
      ${renderTotals(state)}
      ${renderSeats(state)}
      ${renderWaste(state)}
      ${renderFooter(state)}
    </div>`;

  document.getElementById('fleet-change-folder').addEventListener('click', async (e) => {
    e.preventDefault();
    const folderPath = await window.tokenTracker.fleet.pickFolder();
    if (!folderPath) return;
    await window.tokenTracker.fleet.connect(folderPath);
    refreshFleetView();
  });
}

async function refreshFleetView() {
  try {
    const state = await window.tokenTracker.fleet.getState();
    // Transient fleet-folder read errors must not flash the disconnected state; keep the last-rendered view
    if (state && state.error) return;
    lastRefreshedAt = Date.now();
    updateSeatsChip(state);
    if (window.TT && window.TT.footer) window.TT.footer.renderFleet(state);
    if (!state.connected) {
      renderEmptyState();
    } else {
      renderConnected(state);
    }
  } catch {
    return;
  }
}

function mountFleet() {
  refreshFleetView();
  setInterval(refreshFleetView, 10_000);
}
