// test/fleetSnapshotWriter.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { writeFleetSnapshot } = require('../src/main/fleetSnapshotWriter');
const { UsageAggregator } = require('../src/shared/aggregator');

test('writes a JSON snapshot file for this seat', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-write-'));
  const liveAggregator = new UsageAggregator();

  await writeFleetSnapshot({ folderPath, username: 'jsmith', liveAggregator, historyEvents: [] });

  const raw = await fs.readFile(path.join(folderPath, 'jsmith.json'), 'utf8');
  const snapshot = JSON.parse(raw);
  assert.equal(snapshot.username, 'jsmith');
  assert.ok(snapshot.updatedAt);
  assert.ok('spend' in snapshot);
  assert.ok('cacheHitRate' in snapshot);
  assert.deepEqual(snapshot.taskBreakdown, []);
});

test('uses historyAggregator (not liveAggregator) for spend and cacheHitRate', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-write-'));
  const liveAggregator = new UsageAggregator();
  const historyAggregator = new UsageAggregator();
  historyAggregator.ingest({
    kind: 'assistant',
    timestamp: new Date(),
    model: 'claude-3-5-sonnet-20241022',
    usage: { inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    toolUses: [],
  });

  await writeFleetSnapshot({ folderPath, username: 'jsmith', liveAggregator, historyAggregator, historyEvents: [] });

  const raw = await fs.readFile(path.join(folderPath, 'jsmith.json'), 'utf8');
  const snapshot = JSON.parse(raw);
  assert.ok(snapshot.spend > 0, 'spend should reflect historyAggregator usage, not the empty liveAggregator');
});

test('records the running app version, so the Team view can show a version column', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-write-'));
  const liveAggregator = new UsageAggregator();

  await writeFleetSnapshot({ folderPath, username: 'jsmith', appVersion: '2.1.7', liveAggregator, historyEvents: [] });

  const snapshot = JSON.parse(await fs.readFile(path.join(folderPath, 'jsmith.json'), 'utf8'));
  assert.equal(snapshot.appVersion, '2.1.7');
});

// The version has to come from buildInfo, which reports 'unknown' in a dev run. Writing
// that through unchanged is the point: a seat that cannot name its build must say so
// rather than be silently omitted and read as an old client.
test('writes an unknown app version through rather than dropping the field', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-write-'));
  const liveAggregator = new UsageAggregator();

  await writeFleetSnapshot({ folderPath, username: 'jsmith', appVersion: 'unknown', liveAggregator, historyEvents: [] });

  const snapshot = JSON.parse(await fs.readFile(path.join(folderPath, 'jsmith.json'), 'utf8'));
  assert.equal(snapshot.appVersion, 'unknown');
});
