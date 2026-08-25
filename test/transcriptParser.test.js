// test/transcriptParser.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseTranscriptLine } = require('../src/shared/transcriptParser');

function loadFixtureLines(name) {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return raw.split('\n');
}

test('parses an assistant line with tool_use and usage', () => {
  const lines = loadFixtureLines('session-basic.jsonl');
  const event = parseTranscriptLine(lines[1]);
  assert.equal(event.kind, 'assistant');
  assert.equal(event.model, 'claude-sonnet-4-6');
  assert.equal(event.usage.inputTokens, 120);
  assert.equal(event.usage.cacheCreationInputTokens, 500);
  assert.equal(event.toolUses.length, 1);
  assert.equal(event.toolUses[0].name, 'Read');
  assert.equal(event.toolUses[0].id, 'toolu_1');
});

test('parses a user line with tool_result', () => {
  const lines = loadFixtureLines('session-basic.jsonl');
  const event = parseTranscriptLine(lines[2]);
  assert.equal(event.kind, 'user');
  assert.equal(event.toolResults.length, 1);
  assert.equal(event.toolResults[0].toolUseId, 'toolu_1');
  assert.equal(event.isHumanPrompt, false);
});

test('parses a genuine human prompt line', () => {
  const lines = loadFixtureLines('session-basic.jsonl');
  const event = parseTranscriptLine(lines[0]);
  assert.equal(event.kind, 'user');
  assert.equal(event.isHumanPrompt, true);
  assert.equal(event.humanText, 'refactor the auth middleware');
});

test('parses an Agent tool_use with subagent_type', () => {
  const lines = loadFixtureLines('session-agent-spawn.jsonl');
  const event = parseTranscriptLine(lines[0]);
  assert.equal(event.toolUses[0].name, 'Agent');
  assert.equal(event.toolUses[0].input.subagent_type, 'general-purpose');
  assert.equal(event.toolUses[0].input.description, 'verify the change');
});

test('returns null for blank and unparseable lines', () => {
  const lines = loadFixtureLines('session-malformed-line.jsonl');
  assert.equal(parseTranscriptLine('not valid json at all'), null);
  assert.equal(parseTranscriptLine(''), null);
  assert.equal(parseTranscriptLine('   '), null);
});

test('classifies a metadata-only line (no type match) as other', () => {
  const event = parseTranscriptLine('{"ai-title-style-metadata":"x"}');
  assert.equal(event.kind, 'other');
  assert.equal(event.usage, null);
});

// --- follow-up 1: tool results must carry their size ----------------------
// packages/core's findUncappedBashOutput reads `result.resultLength`. Nothing
// ever set it, so the rule evaluated 0 on every iteration and could not fire.
// The rule body was always correct; its input was missing. These tests pin the
// producer, and the last one pins the seam end to end - a unit test on either
// side alone is exactly what let this sit undetected in v1 and v2 both.
const { evaluateOptimizeRules } = require('@tokenmonitor/core');

function userLine(results) {
  return JSON.stringify({
    type: 'user',
    timestamp: '2026-08-21T10:00:00.000Z',
    message: { role: 'user', content: results },
  });
}

test('a tool_result with string content carries its length as resultLength', () => {
  const event = parseTranscriptLine(userLine([
    { type: 'tool_result', tool_use_id: 'toolu_a', content: 'x'.repeat(1234) },
  ]));
  assert.equal(event.toolResults[0].resultLength, 1234);
});

test('a tool_result with block-array content sums its text blocks', () => {
  const event = parseTranscriptLine(userLine([
    {
      type: 'tool_result',
      tool_use_id: 'toolu_b',
      content: [{ type: 'text', text: 'a'.repeat(100) }, { type: 'text', text: 'b'.repeat(50) }],
    },
  ]));
  assert.equal(event.toolResults[0].resultLength, 150);
});

test('a tool_result whose content is absent reports a zero resultLength', () => {
  const event = parseTranscriptLine(userLine([{ type: 'tool_result', tool_use_id: 'toolu_c' }]));
  assert.equal(event.toolResults[0].resultLength, 0);
});

test('a large bash tool_result makes the uncapped-bash-output rule fire', () => {
  const assistant = JSON.stringify({
    type: 'assistant',
    timestamp: '2026-08-21T10:00:00.000Z',
    message: {
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'tool_use', id: 'toolu_big', name: 'Bash', input: { command: 'git log' } }],
    },
  });
  // 12000 chars, well over the 5000-char threshold, and `git log` carries no
  // pagination hint - so the rule must flag it.
  const user = userLine([
    { type: 'tool_result', tool_use_id: 'toolu_big', content: 'o'.repeat(12000) },
  ]);

  const events = [assistant, user].map(parseTranscriptLine);
  const findings = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const finding = findings.find((f) => f.id === 'uncapped-bash-output');

  assert.ok(finding, 'findUncappedBashOutput did not fire on a 12000-char Bash result');
  assert.match(finding.detail, /1 Bash calls returned over 5000 chars/);
});
