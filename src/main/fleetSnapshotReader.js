// src/main/fleetSnapshotReader.js
const fsp = require('node:fs/promises');
const path = require('node:path');

async function readFleetSnapshots(folderPath, stalenessMs = 15 * 60 * 1000) {
  let files;
  try {
    files = await fsp.readdir(folderPath);
  } catch (err) {
    if (err.code === 'ENOENT') return { connected: false, seats: [] };
    throw err;
  }

  const seats = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fsp.readFile(path.join(folderPath, file), 'utf8');
      const snapshot = JSON.parse(raw);
      const ts = new Date(snapshot.updatedAt).getTime();
      const stale = !Number.isFinite(ts) || (Date.now() - ts) > stalenessMs;
      seats.push({ ...snapshot, stale });
    } catch {
      continue; // malformed seat file, skip it rather than failing the whole read
    }
  }
  return { connected: true, seats };
}

module.exports = { readFleetSnapshots };
