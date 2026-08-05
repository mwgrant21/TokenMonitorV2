// src/main/usageScraper.js
// Thin stateful wrapper around the pure parsers. Hooks the pty data path -
// must never throw into it.
const { stripAnsi } = require('../shared/ansiStrip');
const { parseUsagePane, parseLimitWarnings } = require('../shared/usageParser');
const { loadPlanUsage, savePlanUsage } = require('../shared/planUsageConfig');

const BUFFER_CAP = 16384;
const WARNING_TTL_MS = 6 * 60 * 60 * 1000;

function createUsageScraper({ configPath, now = () => Date.now() } = {}) {
  let buffer = '';
  let snapshot = null;
  let warnings = [];

  async function load() {
    snapshot = await loadPlanUsage(configPath);
  }

  function ingest(chunk) {
    try {
      buffer = (buffer + stripAnsi(chunk)).slice(-BUFFER_CAP);
      const pane = parseUsagePane(buffer);
      if (pane) {
        snapshot = { ...pane, capturedAt: now() };
        buffer = '';
        savePlanUsage(configPath, snapshot).catch(() => {});
      }
      const warns = parseLimitWarnings(buffer);
      if (warns.length) {
        warnings = [{ ...warns[0], seenAt: now() }];
        buffer = '';
      }
    } catch {
      /* parsing must never break the pty data path */
    }
  }

  function getSnapshot() {
    return snapshot;
  }

  function getWarnings() {
    const cutoff = now() - WARNING_TTL_MS;
    warnings = warnings.filter((w) => w.seenAt > cutoff);
    return warnings;
  }

  return { ingest, getSnapshot, getWarnings, load };
}

module.exports = { createUsageScraper, BUFFER_CAP, WARNING_TTL_MS };
