// src/main/fleetSnapshotWriter.js
const fsp = require('node:fs/promises');
const path = require('node:path');
const { buildTaskBreakdown } = require('../shared/taskClassifier');
const { evaluateOptimizeRules } = require('../shared/optimizeRules');

async function writeFleetSnapshot({ folderPath, username, liveAggregator, historyAggregator, historyEvents }) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const spendAggregator = historyAggregator || liveAggregator;
  const snapshot = {
    username,
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
