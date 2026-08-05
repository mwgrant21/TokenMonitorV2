// src/shared/exportReport.js
// Pure report builders for the export modal. No fs, no Electron.
const { buildTaskBreakdown } = require('./taskClassifier');
const { eventTime, usageTokens, sessionHistory, modelSplit } = require('./historyAggregator');
const { costForEvent } = require('@tokenmonitor/core');

const DAY_MS = 24 * 60 * 60 * 1000;
const SCOPE_TO_MS = { day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS };
const SCOPE_LABELS = { session: 'This session', day: 'Today', week: 'This week', month: 'This month' };
const KNOWN_SCOPES = Object.keys(SCOPE_LABELS);

function filterByScope(events, scope, clock) {
  if (scope === 'session') {
    const latest = sessionHistory(events, { max: 1, now: () => clock });
    if (!latest.length) return [];
    const id = latest[0].sessionId;
    return events.filter((e) => e.sessionId === id);
  }
  const cutoff = clock.getTime() - SCOPE_TO_MS[scope];
  return events.filter((e) => {
    const t = eventTime(e);
    return t != null && t >= cutoff;
  });
}

// Dashboard convention: budget "used" counts input+output only (cache excluded).
function inOutTokens(events) {
  let used = 0;
  for (const e of events) {
    if (e.kind !== 'assistant' || !e.usage) continue;
    used += e.usage.inputTokens + e.usage.outputTokens;
  }
  return used;
}

function windowUsed(events, sinceMs, clock) {
  const cutoff = clock.getTime() - sinceMs;
  return inOutTokens(events.filter((e) => {
    const t = eventTime(e);
    return t != null && t >= cutoff;
  }));
}

function buildReportData({ events, scope, username, budgets, optimizeFindings, now } = {}) {
  const clock = now ? now() : new Date();
  const scoped = filterByScope(events, scope, clock);
  let tokens = 0;
  let spend = 0;
  for (const e of scoped) {
    if (e.kind !== 'assistant' || !e.usage) continue;
    tokens += usageTokens(e);
    spend += costForEvent(e);
  }
  const budgetVsQuota = {
    session: { used: inOutTokens(filterByScope(events, 'session', clock)), limit: budgets.session.tokens },
    day: { used: windowUsed(events, DAY_MS, clock), limit: budgets.day.tokens },
    week: { used: windowUsed(events, 7 * DAY_MS, clock), limit: budgets.week.tokens },
    month: { used: windowUsed(events, 30 * DAY_MS, clock), limit: budgets.month.tokens },
  };
  return {
    scope,
    scopeLabel: SCOPE_LABELS[scope],
    generatedAt: clock.toISOString(),
    username: username || 'unknown',
    totals: { tokens, spend },
    budgetVsQuota,
    taskBreakdown: buildTaskBreakdown(scoped),
    modelSplit: modelSplit(scoped),
    sessions: sessionHistory(scoped, { now: () => clock, max: 50 }),
    optimizeFindings: (optimizeFindings || []).map((f) => ({
      id: f.id, title: f.title, detail: f.detail, estSavingsPerWeek: f.estSavingsPerWeek,
    })),
  };
}

function csvEscape(v) {
  let s = String(v == null ? '' : v);
  // Prevent CSV/Excel formula injection: a leading =, +, -, or @ is treated
  // as a formula by Excel when the file is opened from the shared folder.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsvReport(data) {
  const lines = ['sessionId,project,task,lastActivity,tokens,spend'];
  for (const s of data.sessions) {
    lines.push([s.sessionId, s.project, s.task, s.lastAt || '', s.tokens, s.spend.toFixed(4)].map(csvEscape).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function mdEscape(v) {
  return String(v == null ? '' : v).replace(/\|/g, '\\|');
}

function buildMarkdownReport(data) {
  const L = [];
  L.push('# Token Tracker report');
  L.push('');
  L.push(`- Generated: ${data.generatedAt}`);
  L.push(`- User: ${data.username}`);
  L.push(`- Range: ${data.scopeLabel}`);
  L.push(`- Total: ${data.totals.tokens} tokens - $${data.totals.spend.toFixed(2)}`);
  L.push('');
  L.push('## Budgets');
  L.push('');
  L.push('| Window | Used | Limit | Used % |');
  L.push('| --- | --- | --- | --- |');
  for (const w of ['session', 'day', 'week', 'month']) {
    const { used, limit } = data.budgetVsQuota[w];
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    L.push(`| ${w} | ${used} | ${limit} | ${pct}% |`);
  }
  L.push('');
  L.push('## Task breakdown');
  L.push('');
  if (data.taskBreakdown.length) {
    L.push('| Category | Tokens |');
    L.push('| --- | --- |');
    for (const b of data.taskBreakdown) L.push(`| ${mdEscape(b.category)} | ${b.tokens} |`);
  } else {
    L.push('No classified activity in range.');
  }
  L.push('');
  L.push('## Model split');
  L.push('');
  if (data.modelSplit.length) {
    L.push('| Model | Tokens | Spend |');
    L.push('| --- | --- | --- |');
    for (const m of data.modelSplit) L.push(`| ${m.tier} | ${m.tokens} | $${m.spend.toFixed(2)} |`);
  } else {
    L.push('No model usage in range.');
  }
  L.push('');
  L.push('## Optimize findings');
  L.push('');
  if (data.optimizeFindings.length) {
    for (const f of data.optimizeFindings) {
      const save = f.estSavingsPerWeek == null ? '' : ` (est. save ~$${Math.round(f.estSavingsPerWeek)}/wk)`;
      L.push(`- **${mdEscape(f.title)}** - ${mdEscape(f.detail)}${save}`);
    }
  } else {
    L.push('None - setup looks healthy.');
  }
  L.push('');
  L.push('## Sessions');
  L.push('');
  if (data.sessions.length) {
    L.push('| Project | Task | Last activity | Tokens | Spend |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const s of data.sessions) {
      L.push(`| ${mdEscape(s.project)} | ${mdEscape(s.task)} | ${s.lastAt || '--'} | ${s.tokens} | $${s.spend.toFixed(2)} |`);
    }
  } else {
    L.push('No sessions in range.');
  }
  L.push('');
  return L.join('\n');
}

function reportFileName(format, scope, now, username) {
  const clock = now instanceof Date ? now : new Date();
  const user = String(username || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
  const y = clock.getFullYear();
  const m = String(clock.getMonth() + 1).padStart(2, '0');
  const d = String(clock.getDate()).padStart(2, '0');
  const ext = format === 'csv' ? 'csv' : 'md';
  return `token-report-${user}-${y}-${m}-${d}-${scope}.${ext}`;
}

module.exports = {
  KNOWN_SCOPES, SCOPE_LABELS, buildReportData, buildCsvReport, buildMarkdownReport, reportFileName,
};
