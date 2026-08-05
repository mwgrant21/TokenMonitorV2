// src/shared/fleetAggregator.js
// Pure team roll-up math over seat snapshot arrays. No fs, no Electron.

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

module.exports = { seatsChipCounts, teamWaste, deptTotals };
