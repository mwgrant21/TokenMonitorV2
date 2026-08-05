const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { findActiveSessionFile, findMostRecentSessionFile } = require('../src/main/activeSessionFinder');

test('returns null when the directory does not exist', async () => {
  const result = await findActiveSessionFile('C:\\definitely\\does\\not\\exist\\zzz');
  assert.equal(result, null);
});

test('returns null when the directory has no jsonl files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-finder-'));
  await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'hi');
  assert.equal(await findActiveSessionFile(tmpDir), null);
});

test('returns the most recently modified jsonl file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-finder-'));
  const older = path.join(tmpDir, 'older.jsonl');
  const newer = path.join(tmpDir, 'newer.jsonl');
  await fs.writeFile(older, '{}');
  await fs.writeFile(newer, '{}');
  const oldTime = new Date(Date.now() - 60_000);
  const newTime = new Date();
  await fs.utimes(older, oldTime, oldTime);
  await fs.utimes(newer, newTime, newTime);

  const result = await findActiveSessionFile(tmpDir);
  assert.equal(result, newer);
});

test('findMostRecentSessionFile finds the newest transcript across sibling project dirs', async () => {
  // Regression: sessions run from any project directory, not just the home
  // dir - the live monitor must not be scoped to one fixed project folder.
  const projectsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-root-'));
  const homeProject = path.join(projectsRoot, '-C-Users-someone');
  const otherProject = path.join(projectsRoot, '-C-Users-someone-projects-widget-app');
  await fs.mkdir(homeProject, { recursive: true });
  await fs.mkdir(otherProject, { recursive: true });

  const staleFile = path.join(homeProject, 'stale.jsonl');
  const activeFile = path.join(otherProject, 'active.jsonl');
  await fs.writeFile(staleFile, '{}');
  await fs.writeFile(activeFile, '{}');
  const oldTime = new Date(Date.now() - 60_000);
  const newTime = new Date();
  await fs.utimes(staleFile, oldTime, oldTime);
  await fs.utimes(activeFile, newTime, newTime);

  const result = await findMostRecentSessionFile(projectsRoot);
  assert.equal(result, activeFile);
});

test('findMostRecentSessionFile returns null when the projects root does not exist', async () => {
  const result = await findMostRecentSessionFile('C:\\definitely\\does\\not\\exist\\zzz');
  assert.equal(result, null);
});
