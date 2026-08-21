// test/versionStatus.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { computeVersionStatus } = require('../src/main/versionStatus');

test('no fleet folder yields unknown, not current', async () => {
  const status = await computeVersionStatus('2.0.0', null);
  assert.equal(status.state, 'unknown');
});

test('folder with no latest.json yields unknown', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'version-status-'));
  const status = await computeVersionStatus('2.0.0', folderPath);
  assert.equal(status.state, 'unknown');
});

test('published version ahead of current reports behind with the bump size', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'version-status-'));
  await fs.writeFile(path.join(folderPath, 'latest.json'), JSON.stringify({ version: '2.1.0' }));
  const status = await computeVersionStatus('2.0.0', folderPath);
  assert.equal(status.state, 'behind');
  assert.equal(status.behindBy, 'minor');
});

test('current version matching published reports current', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'version-status-'));
  await fs.writeFile(path.join(folderPath, 'latest.json'), JSON.stringify({ version: '2.0.0' }));
  const status = await computeVersionStatus('2.0.0', folderPath);
  assert.equal(status.state, 'current');
});

test('malformed latest.json yields unknown instead of throwing', async () => {
  const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'version-status-'));
  await fs.writeFile(path.join(folderPath, 'latest.json'), 'not json');
  const status = await computeVersionStatus('2.0.0', folderPath);
  assert.equal(status.state, 'unknown');
});
