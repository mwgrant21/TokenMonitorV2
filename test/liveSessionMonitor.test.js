// test/liveSessionMonitor.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LiveSessionMonitor } = require('../src/main/liveSessionMonitor');
const { UsageAggregator } = require('../src/shared/aggregator');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('discovers a session file created after start() and ingests its lines', async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'live-monitor-home-'));
  // Regression: the session lives under a project directory with no
  // relationship to homeDir itself - the monitor must not require running
  // Claude Code from the home directory to discover it.
  const cwd = 'C:\\infra\\api-gateway';
  const projectDir = path.join(homeDir, '.claude', 'projects', 'C--infra-api-gateway');
  await fs.mkdir(projectDir, { recursive: true });

  const aggregator = new UsageAggregator();
  const monitor = new LiveSessionMonitor({
    aggregator,
    pollIntervalMs: 20,
    findSessionTimeoutMs: 2000,
    homeDir,
  });
  monitor.start();

  // simulate Claude Code creating its transcript file shortly after launch
  await sleep(50);
  const sessionFile = path.join(projectDir, 'sess-abc.jsonl');
  const line = JSON.stringify({
    type: 'assistant', sessionId: 'sess-abc', timestamp: new Date().toISOString(), cwd,
    message: { model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'hi' }],
      usage: { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  });
  await fs.writeFile(sessionFile, line + '\n');

  await sleep(150);
  monitor.stop();

  const totals = aggregator.getTotals();
  assert.equal(totals.inputTokens, 10);
  assert.equal(totals.outputTokens, 10);
});
