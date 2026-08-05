// test/historyScanner.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { scanAllProjects } = require('../src/main/historyScanner');

test('returns [] for a projects root that does not exist', async () => {
  assert.deepEqual(await scanAllProjects('C:\\does\\not\\exist'), []);
});

test('parses events across multiple project directories and files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'history-scan-'));
  const projA = path.join(root, 'project-a');
  const projB = path.join(root, 'project-b');
  await fs.mkdir(projA, { recursive: true });
  await fs.mkdir(projB, { recursive: true });

  const line = (n) => JSON.stringify({
    type: 'assistant', sessionId: `s${n}`, timestamp: new Date().toISOString(), cwd: 'C:\\x',
    message: { model: 'claude-sonnet-4-6', content: [],
      usage: { input_tokens: n, output_tokens: n, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  });

  await fs.writeFile(path.join(projA, 'sess1.jsonl'), line(1) + '\n' + 'not json\n');
  await fs.writeFile(path.join(projB, 'sess2.jsonl'), line(2) + '\n');

  const events = await scanAllProjects(root);
  const usageEvents = events.filter((e) => e && e.usage);
  assert.equal(usageEvents.length, 2);
  assert.deepEqual(usageEvents.map((e) => e.usage.inputTokens).sort(), [1, 2]);
});
