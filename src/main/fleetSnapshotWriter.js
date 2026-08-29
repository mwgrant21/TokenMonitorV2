// src/main/fleetSnapshotWriter.js
const fsp = require('node:fs/promises');
const path = require('node:path');
const { buildTaskBreakdown } = require('../shared/taskClassifier');
const { evaluateOptimizeRules } = require('@tokenmonitor/core');

async function writeFleetSnapshot({ folderPath, username, appVersion, liveAggregator, historyAggregator, historyEvents }) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const spendAggregator = historyAggregator || liveAggregator;
  const snapshot = {
    username,
    // Always written, never omitted. A seat that cannot name its build has to say so:
    // an absent field is indistinguishable from a client too old to report one, and the
    // Team view would have to guess which it was looking at.
    appVersion: typeof appVersion === 'string' && appVersion ? appVersion : 'unknown',
    updatedAt: new Date().toISOString(),
    spend: spendAggregator.getSpend(weekMs),
    cacheHitRate: spendAggregator.getCacheHitRate(weekMs),
    oneShotRate: liveAggregator.getOneShotRate(),
    runningAgents: liveAggregator.getRunningAgents().length,
    taskBreakdown: buildTaskBreakdown(historyEvents),
    optimizeFindings: evaluateOptimizeRules(historyEvents, weekMs),
  };
  await fsp.writeFile(path.join(folderPath, `${username}.json`), JSON.stringify(snapshot, null, 2), 'utf8');
}

module.exports = { writeFleetSnapshot };
