// test/reportWriter.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { writeReport } = require('../src/main/reportWriter');

async function tmpDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('writes into <share>/reports/ and creates the subdir', async () => {
  const share = await tmpDir('tt-share-');
  const local = path.join(await tmpDir('tt-local-'), 'TokenTracker');
  const res = await writeReport({ content: 'hello', fileName: 'r.md', shareFolder: share, localDir: local });
  assert.strictEqual(res.fallback, false);
  assert.strictEqual(res.dir, path.join(share, 'reports'));
  assert.strictEqual(await fs.readFile(res.path, 'utf8'), 'hello');
});

test('falls back to localDir when the share folder is unreachable', async () => {
  // Point the share at a path whose PARENT is a FILE so mkdir must fail.
  const base = await tmpDir('tt-file-');
  const filePath = path.join(base, 'iam-a-file.txt');
  await fs.writeFile(filePath, 'x', 'utf8');
  const local = path.join(await tmpDir('tt-local-'), 'TokenTracker');
  const res = await writeReport({ content: 'fb', fileName: 'r.csv', shareFolder: path.join(filePath, 'sub'), localDir: local });
  assert.strictEqual(res.fallback, true);
  assert.strictEqual(res.dir, local);
  assert.strictEqual(await fs.readFile(path.join(local, 'r.csv'), 'utf8'), 'fb');
});

test('no share folder configured goes straight to localDir', async () => {
  const local = path.join(await tmpDir('tt-local-'), 'TokenTracker');
  const res = await writeReport({ content: 'x', fileName: 'r.md', shareFolder: null, localDir: local });
  assert.strictEqual(res.fallback, true);
  assert.strictEqual(res.path, path.join(local, 'r.md'));
});

test('creates the local dir recursively', async () => {
  const local = path.join(await tmpDir('tt-local-'), 'a', 'b', 'TokenTracker');
  const res = await writeReport({ content: 'x', fileName: 'r.md', shareFolder: '', localDir: local });
  assert.strictEqual(await fs.readFile(res.path, 'utf8'), 'x');
});
