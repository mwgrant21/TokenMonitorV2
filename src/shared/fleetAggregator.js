// src/shared/fleetAggregator.js
// Pure team roll-up math over seat snapshot arrays. No fs, no Electron.
const { parseVersion, compareVersions } = require('./versionCheck');

function reportingSeats(seats) {
  return (Array.isArray(seats) ? seats : []).filter((s) => s && !s.stale);
}

// seatsChipCounts(seats) -> { total, reporting, active }
function seatsChipCounts(seats) {
  const all = Array.isArray(seats) ? seats : [];
  const reporting = reportingSeats(all);
  return {
    total: all.length,
    reporting: reporting.length,
    active: reporting.filter((s) => (s.runningAgents || 0) > 0).length,
  };
}

// teamWaste(seats) -> [{ id, title, seatCount, totalPerWeek }] sorted by totalPerWeek desc
function teamWaste(seats) {
  const byId = new Map();
  for (const seat of reportingSeats(seats)) {
    if (!Array.isArray(seat.optimizeFindings)) continue;
    for (const f of seat.optimizeFindings) {
      if (!f || typeof f.id !== 'string') continue;
      const cur = byId.get(f.id) || { id: f.id, title: f.title || f.id, seatCount: 0, totalPerWeek: 0 };
      cur.seatCount += 1;
      cur.totalPerWeek += Number.isFinite(f.estSavingsPerWeek) ? f.estSavingsPerWeek : 0;
      byId.set(f.id, cur);
    }
  }
  return [...byId.values()].sort((a, b) => b.totalPerWeek - a.totalPerWeek);
}

// deptTotals(seats) -> { spend, avgCacheHitRate, avgOneShotRate, reporting }
function deptTotals(seats) {
  const reporting = reportingSeats(seats);
  const spend = reporting.reduce((sum, s) => sum + (Number.isFinite(s.spend) ? s.spend : 0), 0);
  const avg = (key) => {
    const vals = reporting.map((s) => s[key]).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  return { spend, avgCacheHitRate: avg('cacheHitRate'), avgOneShotRate: avg('oneShotRate'), reporting: reporting.length };
}

// The label a seat's version renders under. Anything that will not parse -- a missing
// field on a snapshot written before this feature existed, or buildInfo's own 'unknown'
// from a dev run -- collapses to one bucket. Distinct from any real version and never
// counted as behind: we cannot tell, and saying so is the whole discipline of
// versionCheck.js, applied to seats instead of to this machine.
const UNKNOWN_VERSION = 'unknown';

function seatVersion(seat) {
  const claimed = seat && seat.appVersion;
  return typeof claimed === 'string' && parseVersion(claimed) ? claimed : UNKNOWN_VERSION;
}

// versionSpread(seats) -> { newest, distribution: [{ version, count }], behind, unknown }
//
// The reference point is the newest version any seat reports, not latest.json. The
// question this answers is "is the fleet consistent with itself" -- the one you have
// when half the department is still on a build you handed out last month -- and it
// stays answerable on a share with no latest.json at all.
function versionSpread(seats) {
  const reporting = reportingSeats(seats);
  const counts = new Map();
  for (const seat of reporting) {
    const version = seatVersion(seat);
    counts.set(version, (counts.get(version) || 0) + 1);
  }

  // Numeric ordering via compareVersions, not a string sort: lexically, a .10 patch
  // sorts below a .7 one, which would name the wrong build as newest.
  const known = [...counts.keys()].filter((v) => v !== UNKNOWN_VERSION).sort((a, b) => compareVersions(b, a));
  const newest = known.length ? known[0] : null;

  const distribution = known.map((version) => ({ version, count: counts.get(version) }));
  if (counts.has(UNKNOWN_VERSION)) {
    distribution.push({ version: UNKNOWN_VERSION, count: counts.get(UNKNOWN_VERSION) });
  }

  const behind = newest
    ? reporting.filter((seat) => {
        const version = seatVersion(seat);
        return version !== UNKNOWN_VERSION && compareVersions(version, newest) < 0;
      }).length
    : 0;

  return { newest, distribution, behind, unknown: counts.get(UNKNOWN_VERSION) || 0 };
}

module.exports = { seatsChipCounts, teamWaste, deptTotals, versionSpread, UNKNOWN_VERSION };
