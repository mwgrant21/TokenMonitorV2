// test/exportReport.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  KNOWN_SCOPES, SCOPE_LABELS, buildReportData, buildCsvReport, buildMarkdownReport, reportFileName,
} = require('../src/shared/exportReport');

const NOW = () => new Date('2026-07-10T15:00:00');

function assistantEvent({ timestamp, sessionId = 's1', cwd = 'C:\\r\\api-gateway', model = 'claude-sonnet-4-6', input = 0, output = 0 }) {
  return {
    kind: 'assistant', sessionId, timestamp: new Date(timestamp), cwd, model,
    usage: { inputTokens: input, outputTokens: output, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    toolUses: [], toolResults: [], isHumanPrompt: false, humanText: null,
  };
}

function humanEvent(timestamp, text, sessionId = 's1') {
  return {
    kind: 'user', sessionId, timestamp: new Date(timestamp), cwd: 'C:\\r\\api-gateway',
    model: null, usage: null, toolUses: [], toolResults: [], isHumanPrompt: true, humanText: text,
  };
}

const BUDGETS = {
  session: { tokens: 2_000_000 }, day: { tokens: 15_000_000 },
  week: { tokens: 60_000_000 }, month: { tokens: 200_000_000 },
};

test('scope constants line up', () => {
  assert.deepStrictEqual(KNOWN_SCOPES, ['session', 'day', 'week', 'month']);
  assert.strictEqual(SCOPE_LABELS.week, 'This week');
});

test('buildReportData session scope keeps only the most recent session', () => {
  const events = [
    assistantEvent({ timestamp: '2026-07-10T14:00:00', sessionId: 'new', output: 100 }),
    assistantEvent({ timestamp: '2026-07-10T09:00:00', sessionId: 'old', output: 900 }),
  ];
  const data = buildReportData({ events, scope: 'session', username: 'it', budgets: BUDGETS, optimizeFindings: [], now: NOW });
  assert.strictEqual(data.totals.tokens, 100);
  assert.strictEqual(data.sessions.length, 1);
  assert.strictEqual(data.sessions[0].sessionId, 'new');
  assert.strictEqual(data.scopeLabel, 'This session');
});

test('buildReportData day scope filters to the trailing 24h; budgets use all events', () => {
  const events = [
    assistantEvent({ timestamp: '2026-07-10T10:00:00', sessionId: 'a', input: 40, output: 60 }),
    assistantEvent({ timestamp: '2026-07-05T10:00:00', sessionId: 'b', input: 400, output: 600 }), // outside day, inside week
  ];
  const data = buildReportData({ events, scope: 'day', username: 'it', budgets: BUDGETS, optimizeFindings: [], now: NOW });
  assert.strictEqual(data.totals.tokens, 100);
  assert.strictEqual(data.budgetVsQuota.day.used, 100);
  assert.strictEqual(data.budgetVsQuota.week.used, 1100); // all events inside 7d
  assert.strictEqual(data.budgetVsQuota.week.limit, 60_000_000);
});

test('buildCsvReport escapes commas and quotes, CRLF-joined', () => {
  const events = [
    humanEvent('2026-07-10T13:59:00', 'fix the "big, scary" bug'),
    assistantEvent({ timestamp: '2026-07-10T14:00:00', output: 100 }),
  ];
  const data = buildReportData({ events, scope: 'day', username: 'it', budgets: BUDGETS, optimizeFindings: [], now: NOW });
  const csv = buildCsvReport(data);
  const lines = csv.split('\r\n');
  assert.strictEqual(lines[0], 'sessionId,project,task,lastActivity,tokens,spend');
  assert.ok(lines[1].includes('"fix the ""big, scary"" bug"'));
  assert.ok(lines[1].startsWith('s1,api-gateway,'));
  assert.strictEqual(lines[lines.length - 1], ''); // trailing CRLF
});

test('buildCsvReport prefixes formula-triggering task cells to prevent CSV injection', () => {
  const events = [
    humanEvent('2026-07-10T13:59:00', '=HYPERLINK("http://evil")'),
    assistantEvent({ timestamp: '2026-07-10T14:00:00', output: 100 }),
  ];
  const data = buildReportData({ events, scope: 'day', username: 'it', budgets: BUDGETS, optimizeFindings: [], now: NOW });
  const csv = buildCsvReport(data);
  const lines = csv.split('\r\n');
  assert.ok(lines[1].includes('"\'=HYPERLINK('));
});

test('buildMarkdownReport contains every required section', () => {
  const events = [assistantEvent({ timestamp: '2026-07-10T14:00:00', output: 1_000_000 })];
  const findings = [{ id: 'f1', title: 'Route trivial turns to Haiku', detail: 'Sonnet on one-liners', estSavingsPerWeek: 12 }];
  const md = buildMarkdownReport(buildReportData({ events, scope: 'week', username: 'it', budgets: BUDGETS, optimizeFindings: findings, now: NOW }));
  assert.ok(md.startsWith('# Token Tracker report'));
  for (const h of ['## Budgets', '## Task breakdown', '## Model split', '## Optimize findings', '## Sessions']) {
    assert.ok(md.includes(h), `missing ${h}`);
  }
  assert.ok(md.includes('- Range: This week'));
  assert.ok(md.includes('| week | 1000000 | 60000000 | 2% |'));
  assert.ok(md.includes('| sonnet | 1000000 | $15.00 |'));
  assert.ok(md.includes('**Route trivial turns to Haiku**'));
  assert.ok(md.includes('(est. save ~$12/wk)'));
});

test('buildMarkdownReport empty-state lines', () => {
  const md = buildMarkdownReport(buildReportData({ events: [], scope: 'day', username: 'it', budgets: BUDGETS, optimizeFindings: [], now: NOW }));
  assert.ok(md.includes('None - setup looks healthy.'));
  assert.ok(md.includes('No sessions in range.'));
  assert.ok(md.includes('No model usage in range.'));
});

test('markdown escapes pipes in cell text', () => {
  const events = [
    humanEvent('2026-07-10T13:59:00', 'weird | piped | prompt'),
    assistantEvent({ timestamp: '2026-07-10T14:00:00', output: 100 }),
  ];
  const md = buildMarkdownReport(buildReportData({ events, scope: 'day', username: 'it', budgets: BUDGETS, optimizeFindings: [], now: NOW }));
  assert.ok(md.includes('weird \\| piped \\| prompt'));
});

test('reportFileName stamps user, date, scope, extension', () => {
  const now = new Date('2026-07-10T15:00:00');
  assert.strictEqual(reportFileName('csv', 'week', now, 'IT Dept'), 'token-report-it-dept-2026-07-10-week.csv');
  assert.strictEqual(reportFileName('md', 'session', now, ''), 'token-report-user-2026-07-10-session.md');
});
