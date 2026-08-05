// test/taskClassifier.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyEvent, buildTaskBreakdown } = require('../src/shared/taskClassifier');

function eventWithTools(toolUses) {
  return { kind: 'assistant', toolUses, model: 'claude-sonnet-4-6' };
}

test('classifies Edit/Write tool use as Coding', () => {
  assert.equal(classifyEvent(eventWithTools([{ name: 'Edit', input: {} }])), 'Coding');
  assert.equal(classifyEvent(eventWithTools([{ name: 'Write', input: {} }])), 'Coding');
});

test('classifies a test-runner Bash command as Testing', () => {
  const event = eventWithTools([{ name: 'Bash', input: { command: 'npm test -- auth' } }]);
  assert.equal(classifyEvent(event), 'Testing');
});

test('classifies a debug-flavored Bash command as Debugging', () => {
  const event = eventWithTools([{ name: 'Bash', input: { command: 'grep -r "stacktrace" logs/' } }]);
  assert.equal(classifyEvent(event), 'Debugging');
});

test('classifies Grep/Glob/Read-only tool use as Exploration', () => {
  assert.equal(classifyEvent(eventWithTools([{ name: 'Grep', input: {} }])), 'Exploration');
  assert.equal(classifyEvent(eventWithTools([{ name: 'Read', input: {} }])), 'Exploration');
});

test('returns null for non-assistant events', () => {
  assert.equal(classifyEvent({ kind: 'user', toolUses: [] }), null);
});

test('returns null for assistant events with no tool use', () => {
  assert.equal(classifyEvent({ kind: 'assistant', toolUses: [] }), null);
});

test('falls back to Exploration for unrecognized tool combinations', () => {
  const event = eventWithTools([{ name: 'Agent', input: {} }]);
  assert.equal(classifyEvent(event), 'Exploration');
});

test('buildTaskBreakdown sums tokens per category, sorted descending', () => {
  const codingEvent = {
    kind: 'assistant', toolUses: [{ name: 'Edit', input: {} }],
    usage: { inputTokens: 10, outputTokens: 10, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  };
  const explorationEvent = {
    kind: 'assistant', toolUses: [{ name: 'Read', input: {} }],
    usage: { inputTokens: 1, outputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  };
  const noUsageEvent = { kind: 'assistant', toolUses: [{ name: 'Edit', input: {} }], usage: null };

  const breakdown = buildTaskBreakdown([codingEvent, explorationEvent, noUsageEvent]);
  assert.deepEqual(breakdown, [
    { category: 'Coding', tokens: 20 },
    { category: 'Exploration', tokens: 2 },
  ]);
});

test('buildTaskBreakdown returns [] for events with no classifiable tool use', () => {
  assert.deepEqual(buildTaskBreakdown([{ kind: 'user', toolUses: [] }]), []);
});
