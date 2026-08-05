const test = require('node:test');
const assert = require('node:assert/strict');
const { UsageAggregator, isCorrection } = require('../src/shared/aggregator');
const { parseTranscriptLine } = require('../src/shared/transcriptParser');

function assistantEvent({ timestamp, model = 'claude-sonnet-4-6', input = 10, output = 10, cacheCreate = 0, cacheRead = 0, toolUses = [] }) {
  return {
    kind: 'assistant',
    sessionId: 's1',
    timestamp: new Date(timestamp),
    cwd: 'C:\\x',
    model,
    usage: { inputTokens: input, outputTokens: output, cacheCreationInputTokens: cacheCreate, cacheReadInputTokens: cacheRead },
    toolUses,
    toolResults: [],
    isHumanPrompt: false,
    humanText: null,
  };
}

function humanPromptEvent(timestamp, text) {
  return {
    kind: 'user', sessionId: 's1', timestamp: new Date(timestamp), cwd: 'C:\\x',
    model: null, usage: null, toolUses: [], toolResults: [], isHumanPrompt: true, humanText: text,
  };
}

function toolResultEvent(timestamp, toolUseId) {
  return {
    kind: 'user', sessionId: 's1', timestamp: new Date(timestamp), cwd: 'C:\\x',
    model: null, usage: null, toolUses: [], toolResults: [{ toolUseId }], isHumanPrompt: false, humanText: null,
  };
}

test('tracks running agents until their tool_result arrives', () => {
  const agg = new UsageAggregator();
  agg.ingest(assistantEvent({
    timestamp: '2026-07-08T09:00:00Z',
    toolUses: [{ id: 'toolu_1', name: 'Agent', input: { description: 'verify', subagent_type: 'general-purpose' } }],
  }));
  assert.equal(agg.getRunningAgents().length, 1);
  assert.equal(agg.getRunningAgents()[0].description, 'verify');

  agg.ingest(toolResultEvent('2026-07-08T09:01:00Z', 'toolu_1'));
  assert.equal(agg.getRunningAgents().length, 0);
});

test('computes burn rate over a trailing window', () => {
  const now = () => new Date('2026-07-08T09:10:00Z');
  const agg = new UsageAggregator({ now });
  // inside the 5-minute window
  agg.ingest(assistantEvent({ timestamp: '2026-07-08T09:08:00Z', input: 1000, output: 1000 }));
  // outside the window (10 min ago)
  agg.ingest(assistantEvent({ timestamp: '2026-07-08T09:00:00Z', input: 999999, output: 999999 }));

  const rate = agg.getBurnRate(5 * 60 * 1000);
  // only the in-window event (2000 tokens) counts, over 5 minutes = 400 tok/min
  assert.equal(rate, 400);
});

test('computes cache hit rate', () => {
  const agg = new UsageAggregator();
  agg.ingest(assistantEvent({ timestamp: '2026-07-08T09:00:00Z', cacheCreate: 100, cacheRead: 900 }));
  assert.equal(agg.getCacheHitRate(), 0.9);
});

test('cache hit rate is 0 when nothing cacheable has happened yet', () => {
  const agg = new UsageAggregator();
  assert.equal(agg.getCacheHitRate(), 0);
});

test('one-shot rate: no correction markers means fully 1-shot', () => {
  const agg = new UsageAggregator();
  agg.ingest(humanPromptEvent('2026-07-08T09:00:00Z', 'refactor the middleware'));
  agg.ingest(humanPromptEvent('2026-07-08T09:05:00Z', 'now update the readme'));
  assert.equal(agg.getOneShotRate(), 1);
});

test('one-shot rate: a correction-marker prompt counts against it', () => {
  const agg = new UsageAggregator();
  agg.ingest(humanPromptEvent('2026-07-08T09:00:00Z', 'refactor the middleware'));
  agg.ingest(humanPromptEvent('2026-07-08T09:05:00Z', "actually that's wrong, revert it"));
  assert.equal(agg.getOneShotRate(), 0.5);
});

test('one-shot rate is null with no human prompts yet', () => {
  const agg = new UsageAggregator();
  assert.equal(agg.getOneShotRate(), null);
});

test('getSpend sums cost across ingested events', () => {
  const agg = new UsageAggregator();
  agg.ingest(assistantEvent({ timestamp: '2026-07-08T09:00:00Z', input: 1_000_000, output: 1_000_000 }));
  const spend = agg.getSpend();
  assert.equal(Math.round(spend), 18);
});

test('open agent calls accrue input+output tokens from events ingested while open', () => {
  const agg = new UsageAggregator();
  agg.ingest({
    kind: 'assistant', timestamp: new Date(), model: 'claude-sonnet-4-6',
    usage: null,
    toolUses: [{ id: 'tu1', name: 'Agent', input: { description: 'sweep', subagent_type: 'grep-sweep' } }],
    toolResults: [], isHumanPrompt: false, humanText: null,
  });
  agg.ingest({
    kind: 'assistant', timestamp: new Date(), model: 'claude-sonnet-4-6',
    usage: { inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 9999, cacheReadInputTokens: 9999 },
    toolUses: [], toolResults: [], isHumanPrompt: false, humanText: null,
  });
  const agents = agg.getRunningAgents();
  assert.strictEqual(agents.length, 1);
  assert.strictEqual(agents[0].tokens, 1500); // input+output only, cache excluded
});

test('agent token accrual starts at zero and stops when the call closes', () => {
  const agg = new UsageAggregator();
  agg.ingest({
    kind: 'assistant', timestamp: new Date(), model: 'm', usage: null,
    toolUses: [{ id: 'tu2', name: 'Agent', input: { subagent_type: 'x' } }],
    toolResults: [], isHumanPrompt: false, humanText: null,
  });
  assert.strictEqual(agg.getRunningAgents()[0].tokens, 0);
  agg.ingest({
    kind: 'user', timestamp: new Date(), model: null, usage: null,
    toolUses: [], toolResults: [{ toolUseId: 'tu2' }], isHumanPrompt: false, humanText: null,
  });
  assert.strictEqual(agg.getRunningAgents().length, 0);
});

test('isCorrection is exported and matches the marker list', () => {
  assert.equal(isCorrection('No, that is wrong'), true);
  assert.equal(isCorrection('actually use the other file'), true);
  assert.equal(isCorrection('please add a search feature'), false);
});
