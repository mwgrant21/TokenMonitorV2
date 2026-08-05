// Persisted /usage snapshot (survives restart). Config-module pattern, but
// load does NOT seed a default file - null means "never synced".
const fsp = require('node:fs/promises');
const path = require('node:path');

function pctOk(v) {
  return v && typeof v === 'object' && Number.isFinite(v.pct) && v.pct >= 0 && v.pct <= 100;
}

function sanitizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tierOk = raw.tier === 'pro' || raw.tier === 'max' || raw.tier === null;
  if (!tierOk || !pctOk(raw.session) || !pctOk(raw.week)) return null;
  if (typeof raw.week.resetsAt !== 'string' || !raw.week.resetsAt.length || raw.week.resetsAt.length > 80) return null;
  if (!(raw.weekModel === null || pctOk(raw.weekModel))) return null;
  if (!Number.isFinite(raw.capturedAt) || raw.capturedAt <= 0) return null;
  return {
    tier: raw.tier,
    session: { pct: raw.session.pct },
    week: { pct: raw.week.pct, resetsAt: raw.week.resetsAt },
    weekModel: raw.weekModel === null ? null : { pct: raw.weekModel.pct },
    capturedAt: raw.capturedAt,
  };
}

async function loadPlanUsage(configPath) {
  try {
    return sanitizeSnapshot(JSON.parse(await fsp.readFile(configPath, 'utf8')));
  } catch {
    return null;
  }
}

async function savePlanUsage(configPath, snapshot) {
  const clean = sanitizeSnapshot(snapshot);
  if (!clean) return;
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(clean, null, 2), 'utf8');
}

module.exports = { sanitizeSnapshot, loadPlanUsage, savePlanUsage };
