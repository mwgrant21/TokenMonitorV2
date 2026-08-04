// test/optimizeRules.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateOptimizeRules, evaluateOptimizeRulesWithRecurrence, summarizeOptimize } = require('../dist/cjs/optimizeRules.cjs');

function opusTrivialEvent(i) {
  return {
    kind: 'assistant', timestamp: new Date(`2026-07-08T09:0${i}:00Z`), model: 'claude-opus-4-8',
    usage: { inputTokens: 50, outputTokens: 40, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    toolUses: [], toolResults: [], isHumanPrompt: false, humanText: null,
  };
}

function repeatedReadEvent(i, filePath = 'CLAUDE.md') {
  return {
    kind: 'assistant', timestamp: new Date(`2026-07-08T10:0${i}:00Z`), model: 'claude-sonnet-4-6',
    usage: { inputTokens: 10, outputTokens: 10, cacheCreationInputTokens: 2000, cacheReadInputTokens: 0 },
    toolUses: [{ id: `r${filePath}${i}`, name: 'Read', input: { file_path: filePath } }],
    toolResults: [], isHumanPrompt: false, humanText: null,
  };
}

function uncappedBashEvent() {
  return {
    kind: 'assistant', timestamp: new Date('2026-07-08T11:00:00Z'), model: 'claude-sonnet-4-6',
    usage: { inputTokens: 10, outputTokens: 10, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    toolUses: [{ id: 'b1', name: 'Bash', input: { command: 'cat build.log' } }],
    toolResults: [], isHumanPrompt: false, humanText: null,
  };
}

function bashResultEvent(toolUseId, contentLength) {
  return {
    kind: 'user', timestamp: new Date('2026-07-08T11:00:01Z'), model: null, usage: null,
    toolUses: [], toolResults: [{ toolUseId }], isHumanPrompt: false, humanText: null,
    _rawResultLength: contentLength,
  };
}

test('flags Opus used on trivial (low-output) turns', () => {
  const events = [opusTrivialEvent(1), opusTrivialEvent(2), opusTrivialEvent(3)];
  const findings = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const finding = findings.find((f) => f.id === 'opus-on-trivial-turns');
  assert.ok(finding, 'expected an opus-on-trivial-turns finding');
  assert.ok(finding.estSavingsPerWeek > 0);
});

test('flags the same file read repeatedly without a cache hit', () => {
  const events = [repeatedReadEvent(1), repeatedReadEvent(2), repeatedReadEvent(3)];
  const findings = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const finding = findings.find((f) => f.id === 'unpinned-config-re-reads');
  assert.ok(finding, 'expected an unpinned-config-re-reads finding');
  assert.match(finding.detail, /CLAUDE\.md/);
});

test('aggregates ALL offending files into one finding, not just the first', () => {
  const events = [
    repeatedReadEvent(1, 'CLAUDE.md'), repeatedReadEvent(2, 'CLAUDE.md'), repeatedReadEvent(3, 'CLAUDE.md'),
    repeatedReadEvent(4, 'config.json'), repeatedReadEvent(5, 'config.json'), repeatedReadEvent(6, 'config.json'),
  ];
  const findings = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const matching = findings.filter((f) => f.id === 'unpinned-config-re-reads');
  assert.equal(matching.length, 1, 'expected exactly one finding, not one per file');
  assert.match(matching[0].detail, /CLAUDE\.md/);
  assert.match(matching[0].detail, /config\.json/);
});

test('unpinned-config-re-reads caps the listed files so a long list cannot blow up the UI', () => {
  const events = [];
  for (let f = 0; f < 8; f++) {
    const name = `C:\\some\\dir\\file${f}.md`;
    events.push(repeatedReadEvent(1, name), repeatedReadEvent(2, name), repeatedReadEvent(3, name));
  }
  const findings = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const finding = findings.find((f) => f.id === 'unpinned-config-re-reads');
  assert.ok(finding, 'expected an unpinned-config-re-reads finding');
  // The full count is still reported...
  assert.match(finding.detail, /8 file/);
  // ...but the enumerated list is capped with a "+N more" summary, not all 8 paths.
  assert.match(finding.detail, /more/, 'expected a "+N more" summary indicator');
  const listed = [...Array(8).keys()].filter((f) => finding.detail.includes(`file${f}.md`));
  assert.ok(listed.length <= 3, `expected at most 3 files enumerated, got ${listed.length}`);
  // Detail must not contain full Windows paths that explode the card.
  assert.ok(!finding.detail.includes('C:\\some\\dir'), 'expected basenames, not full paths');
});

test('flags uncapped bash output over the size threshold', () => {
  const events = [uncappedBashEvent(), bashResultEvent('b1', 20000)];
  const findings = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const finding = findings.find((f) => f.id === 'uncapped-bash-output');
  assert.ok(finding, 'expected an uncapped-bash-output finding');
});

test('produces no findings for a clean, well-behaved session', () => {
  const events = [
    { kind: 'assistant', timestamp: new Date(), model: 'claude-sonnet-4-6',
      usage: { inputTokens: 10, outputTokens: 500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
      toolUses: [{ id: 'e1', name: 'Edit', input: {} }], toolResults: [], isHumanPrompt: false, humanText: null },
  ];
  assert.deepEqual(evaluateOptimizeRules(events, 60 * 60 * 1000), []);
});

test('summarizeOptimize sums estSavingsPerWeek across findings', () => {
  const findings = [
    { estSavingsPerWeek: 3.5 },
    { estSavingsPerWeek: 4 },
    { estSavingsPerWeek: 1.25 },
  ];
  assert.equal(summarizeOptimize(findings).totalPerWeek, 8.75);
});

test('summarizeOptimize empty findings -> total 0 and grade A', () => {
  assert.deepEqual(summarizeOptimize([]), { totalPerWeek: 0, grade: 'A' });
});

test('summarizeOptimize grade A below 10', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 9.99 }]).grade, 'A');
});

test('summarizeOptimize grade boundary: 10 -> B', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 10 }]).grade, 'B');
});

test('summarizeOptimize grade B below 25', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 24.99 }]).grade, 'B');
});

test('summarizeOptimize grade boundary: 25 -> C', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 25 }]).grade, 'C');
});

test('summarizeOptimize grade C below 50', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 49.99 }]).grade, 'C');
});

test('summarizeOptimize grade boundary: 50 -> D', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 50 }]).grade, 'D');
});

test('summarizeOptimize grade D above 50', () => {
  assert.equal(summarizeOptimize([{ estSavingsPerWeek: 120 }]).grade, 'D');
});

test('evaluateOptimizeRulesWithRecurrence: no applied state -> passthrough, no recurring flag', () => {
  const events = [opusTrivialEvent(1), opusTrivialEvent(2), opusTrivialEvent(3)];
  const plain = evaluateOptimizeRules(events, 60 * 60 * 1000);
  const withState = evaluateOptimizeRulesWithRecurrence(events, 60 * 60 * 1000, {});
  assert.deepEqual(withState, plain);
  assert.ok(!withState[0].recurring);
});

test('evaluateOptimizeRulesWithRecurrence: fix held (no events since appliedAt) -> finding dropped', () => {
  const events = [opusTrivialEvent(1), opusTrivialEvent(2), opusTrivialEvent(3)];
  const appliedAtMs = new Date('2026-07-08T09:04:00Z').getTime(); // after all 3 events
  const findings = evaluateOptimizeRulesWithRecurrence(events, 60 * 60 * 1000, {
    'opus-on-trivial-turns': appliedAtMs,
  });
  assert.equal(findings.find((f) => f.id === 'opus-on-trivial-turns'), undefined);
});

test('evaluateOptimizeRulesWithRecurrence: recurs after appliedAt -> kept, tagged recurring, fresh numbers', () => {
  const events = [opusTrivialEvent(1), opusTrivialEvent(2), opusTrivialEvent(3)];
  // Cuts off between event 1 and events 2/3: two events recur after the "fix."
  const appliedAtMs = new Date('2026-07-08T09:01:30Z').getTime();
  const findings = evaluateOptimizeRulesWithRecurrence(events, 60 * 60 * 1000, {
    'opus-on-trivial-turns': appliedAtMs,
  });
  const finding = findings.find((f) => f.id === 'opus-on-trivial-turns');
  assert.ok(finding, 'expected the finding to still show since it recurred');
  assert.equal(finding.recurring, true);
  assert.equal(finding.appliedAtMs, appliedAtMs);
  // Fresh evaluation is over only the 2 post-appliedAt events, not all 3.
  const freshOnly = evaluateOptimizeRules([opusTrivialEvent(2), opusTrivialEvent(3)], 60 * 60 * 1000);
  assert.equal(finding.estSavingsPerWeek, freshOnly.find((f) => f.id === 'opus-on-trivial-turns').estSavingsPerWeek);
});

test('evaluateOptimizeRulesWithRecurrence: findings never applied are unaffected by unrelated applied state', () => {
  const events = [repeatedReadEvent(1), repeatedReadEvent(2), repeatedReadEvent(3)];
  const appliedAtMs = new Date('2026-07-08T09:04:00Z').getTime();
  const findings = evaluateOptimizeRulesWithRecurrence(events, 60 * 60 * 1000, {
    'opus-on-trivial-turns': appliedAtMs, // a different finding id
  });
  const finding = findings.find((f) => f.id === 'unpinned-config-re-reads');
  assert.ok(finding, 'expected the unrelated finding to pass through untouched');
  assert.ok(!finding.recurring);
});
