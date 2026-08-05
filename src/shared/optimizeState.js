// src/shared/optimizeState.js
// Persists when each Optimize finding was last (re)applied, keyed by finding
// id. Kept separate from CLAUDE.md (the guidance text itself) so recurrence
// checks don't depend on parsing timestamps out of a file meant for humans
// and Claude, not app state.
const fsp = require('node:fs/promises');
const path = require('node:path');

function sanitizeState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [id, ts] of Object.entries(src)) {
    if (typeof ts === 'number' && Number.isFinite(ts)) out[id] = ts;
  }
  return out;
}

async function writeState(statePath, state) {
  await fsp.mkdir(path.dirname(statePath), { recursive: true });
  await fsp.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

async function loadOptimizeState(statePath) {
  try {
    const raw = await fsp.readFile(statePath, 'utf8');
    return sanitizeState(JSON.parse(raw));
  } catch (err) {
    return {};
  }
}

// Records/resets the appliedAt timestamp for a finding id. Called on every
// successful Apply-fix action, including a reapply where the guidance bullet
// was already present, so "Apply" always means "recurrence check starts now."
async function recordAppliedAt(statePath, findingId, whenMs) {
  const current = await loadOptimizeState(statePath);
  current[findingId] = whenMs;
  await writeState(statePath, current);
  return current;
}

module.exports = { sanitizeState, loadOptimizeState, recordAppliedAt };
