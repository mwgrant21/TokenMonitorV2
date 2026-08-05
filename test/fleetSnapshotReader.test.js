// test/fleetSnapshotReader.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readFleetSnapshots } = require('../src/main/fleetSnapshotReader');

test('reports not connected when the folder does not exist', async () => {
  const result = await readFleetSnapshots('C:\\does\\not\\exist');
  assert.equal(result.connected, false);
  assert.deepEqual(result.seats, []);
});

test('reads all seat files and flags stale ones', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-read-'));
  await fs.writeFile(path.join(folderPath, 'fresh.json'), JSON.stringify({ username: 'fresh', updatedAt: new Date().toISOString(), spend: 10 }));
  const staleTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await fs.writeFile(path.join(folderPath, 'stale.json'), JSON.stringify({ username: 'stale', updatedAt: staleTime, spend: 5 }));

  const result = await readFleetSnapshots(folderPath, 15 * 60 * 1000);
  assert.equal(result.connected, true);
  assert.equal(result.seats.length, 2);
  const fresh = result.seats.find((s) => s.username === 'fresh');
  const stale = result.seats.find((s) => s.username === 'stale');
  assert.equal(fresh.stale, false);
  assert.equal(stale.stale, true);
});

test('skips malformed seat files without throwing', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-read-'));
  await fs.writeFile(path.join(folderPath, 'broken.json'), 'not json');
  await fs.writeFile(path.join(folderPath, 'ok.json'), JSON.stringify({ username: 'ok', updatedAt: new Date().toISOString(), spend: 1 }));

  const result = await readFleetSnapshots(folderPath);
  assert.equal(result.seats.length, 1);
  assert.equal(result.seats[0].username, 'ok');
});

test('treats invalid or missing updatedAt as stale', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-read-'));
  await fs.writeFile(path.join(folderPath, 'invalid-date.json'), JSON.stringify({ username: 'invalid', updatedAt: 'not-a-date', spend: 5 }));
  await fs.writeFile(path.join(folderPath, 'missing-date.json'), JSON.stringify({ username: 'missing', spend: 10 }));

  const result = await readFleetSnapshots(folderPath);
  assert.equal(result.seats.length, 2);
  const invalidSeat = result.seats.find((s) => s.username === 'invalid');
  const missingSeat = result.seats.find((s) => s.username === 'missing');
  assert.equal(invalidSeat.stale, true);
  assert.equal(missingSeat.stale, true);
});
