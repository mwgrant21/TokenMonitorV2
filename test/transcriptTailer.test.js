const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { TranscriptTailer } = require('../src/main/transcriptTailer');

test('reads nothing from an empty file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailer-'));
  const filePath = path.join(tmpDir, 'session.jsonl');
  await fs.writeFile(filePath, '');
  const tailer = new TranscriptTailer(filePath);
  assert.deepEqual(await tailer.readNew(), []);
});

test('reads complete lines only, holding back an incomplete trailing line', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailer-'));
  const filePath = path.join(tmpDir, 'session.jsonl');
  await fs.writeFile(filePath, '{"a":1}\n{"a":2}\n{"a":3} incomplete');
  const tailer = new TranscriptTailer(filePath);

  const lines = await tailer.readNew();
  assert.deepEqual(lines, ['{"a":1}', '{"a":2}']);

  // nothing new until the incomplete line is terminated
  assert.deepEqual(await tailer.readNew(), []);

  await fs.appendFile(filePath, '\n{"a":4}\n');
  const moreLines = await tailer.readNew();
  assert.deepEqual(moreLines, ['{"a":3} incomplete', '{"a":4}']);
});

test('correctly advances offset in bytes, not UTF-16 length, for multi-byte characters', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailer-'));
  const filePath = path.join(tmpDir, 'session.jsonl');
  const emojiLine = '{"a":"🚀 multi-byte"}';
  await fs.writeFile(filePath, emojiLine + '\n', 'utf8');
  const tailer = new TranscriptTailer(filePath);

  const firstLines = await tailer.readNew();
  assert.deepEqual(firstLines, [emojiLine]);

  // If the offset advanced by UTF-16 code-unit length instead of byte length,
  // this read would start a few bytes into the appended line, garbling it —
  // the emoji is 4 bytes in UTF-8 but only 2 UTF-16 code units in JS string length.
  await fs.appendFile(filePath, '{"b":"plain line"}\n', 'utf8');
  const secondLines = await tailer.readNew();
  assert.deepEqual(secondLines, ['{"b":"plain line"}']);
});
