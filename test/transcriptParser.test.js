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
