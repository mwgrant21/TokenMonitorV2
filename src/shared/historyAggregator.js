// src/shared/historyAggregator.js
// Pure history analytics over parsed transcript events (the normalized shape
// from transcriptParser). Consumes the RAW event array - not UsageAggregator,
// which drops cwd/sessionId on ingest. No fs, no Electron - unit-testable.
const { costForEvent, pricingTierForModel } = require('./modelPricing');
const { isCorrection } = require('./aggregator');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// timestamp may be a Date or an ISO string (main.js already defends both).
function eventTime(e) {
  if (!e || !e.timestamp) return null;
  const t = e.timestamp instanceof Date ? e.timestamp.getTime() : new Date(e.timestamp).getTime();
  return Number.isFinite(t) ? t : null;
}

function usageTokens(e) {
  if (!e || !e.usage) return 0;
  return e.usage.inputTokens + e.usage.outputTokens + e.usage.cacheCreationInputTokens + e.usage.cacheReadInputTokens;
}

function projectName(cwd) {
  if (!cwd) return 'unknown';
  const parts = String(cwd).split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'unknown';
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Bucketed token/spend series for the burn-trend chart. Daily buckets step a
// fixed 24h back from local end-of-today (DST +/-1h drift tolerated in v1).
function burnSeries(events, { period, now } = {}) {
  const clock = now ? now() : new Date();
  const hourly = period === 'today';
  const bucketCount = hourly ? 24 : period === '7d' ? 7 : 30;
  const bucketMs = hourly ? HOUR_MS : DAY_MS;
  const end = hourly ? clock.getTime() : startOfLocalDay(clock).getTime() + DAY_MS;
  const start = end - bucketCount * bucketMs;

  const points = [];
  for (let i = 0; i < bucketCount; i++) {
    const bStart = new Date(start + i * bucketMs);
    let label;
    if (hourly) label = `${bStart.getHours()}h`;
    else if (period === '7d') label = DOW[bStart.getDay()];
    else label = `${bStart.getMonth() + 1}/${bStart.getDate()}`;
    points.push({ label, tokens: 0, spend: 0 });
  }

  for (const e of events) {
    if (e.kind !== 'assistant' || !e.usage) continue;
    const t = eventTime(e);
    if (t == null || t < start || t >= end) continue;
    const i = Math.min(bucketCount - 1, Math.floor((t - start) / bucketMs));
    points[i].tokens += usageTokens(e);
    points[i].spend += costForEvent(e);
  }

  let peakIndex = -1;
  let peak = 0;
  points.forEach((p, i) => {
    if (p.tokens > peak) { peak = p.tokens; peakIndex = i; }
  });
  return { points, peakIndex, labelEvery: hourly ? 4 : period === '7d' ? 1 : 5 };
}

function spendByProject(events, { sinceMs, now, max = 5 } = {}) {
  const clock = now ? now() : new Date();
  const cutoff = sinceMs == null ? null : clock.getTime() - sinceMs;
  const byProject = new Map();
  for (const e of events) {
    if (e.kind !== 'assistant' || !e.usage) continue;
    const t = eventTime(e);
    if (cutoff != null && (t == null || t < cutoff)) continue;
    const name = projectName(e.cwd);
    byProject.set(name, (byProject.get(name) || 0) + costForEvent(e));
  }
  const rows = [...byProject.entries()]
    .map(([name, spend]) => ({ name, spend }))
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, max);
  const total = rows.reduce((s, r) => s + r.spend, 0);
  return rows.map((r) => ({ ...r, pct: total > 0 ? Math.round((r.spend / total) * 100) : 0 }));
}

function oneLine(text, maxLen) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > maxLen ? `${t.slice(0, maxLen - 3)}...` : t;
}

function relTime(ageMs) {
  if (ageMs == null) return '--';
  const m = Math.floor(ageMs / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 2 ? 'yest.' : `${d}d ago`;
}

function sessionHistory(events, { max = 8, now, activeMs = 5 * 60 * 1000 } = {}) {
  const clock = now ? now() : new Date();
  const sessions = new Map();
  for (const e of events) {
    if (!e.sessionId) continue;
    let s = sessions.get(e.sessionId);
    if (!s) {
      s = { sessionId: e.sessionId, cwd: null, task: null, lastMs: null, tokens: 0, spend: 0 };
      sessions.set(e.sessionId, s);
    }
    if (e.cwd && !s.cwd) s.cwd = e.cwd;
    const t = eventTime(e);
    if (t != null && (s.lastMs == null || t > s.lastMs)) s.lastMs = t;
    if (s.task == null && e.isHumanPrompt && e.humanText) s.task = oneLine(e.humanText, 60);
    if (e.kind === 'assistant' && e.usage) {
      s.tokens += usageTokens(e);
      s.spend += costForEvent(e);
    }
  }
  return [...sessions.values()]
    .sort((a, b) => (b.lastMs || 0) - (a.lastMs || 0))
    .slice(0, max)
    .map((s) => {
      const ageMs = s.lastMs == null ? null : clock.getTime() - s.lastMs;
      const active = ageMs != null && ageMs >= 0 && ageMs < activeMs;
      return {
        sessionId: s.sessionId,
        project: projectName(s.cwd),
        task: s.task || '(no prompt)',
        lastAt: s.lastMs == null ? null : new Date(s.lastMs).toISOString(),
        timeLabel: active ? 'active' : relTime(ageMs),
        tokens: s.tokens,
        spend: s.spend,
        active,
      };
    });
}

function modelSplit(events, { sinceMs, now } = {}) {
  const clock = now ? now() : new Date();
  const cutoff = sinceMs == null ? null : clock.getTime() - sinceMs;
  const byTier = new Map();
  for (const e of events) {
    if (e.kind !== 'assistant' || !e.usage) continue;
    const t = eventTime(e);
    if (cutoff != null && (t == null || t < cutoff)) continue;
    const tier = pricingTierForModel(e.model);
    const cur = byTier.get(tier) || { tier, tokens: 0, spend: 0 };
    cur.tokens += usageTokens(e);
    cur.spend += costForEvent(e);
    byTier.set(tier, cur);
  }
  return [...byTier.values()].sort((a, b) => b.spend - a.spend);
}

function windowStats(events, fromMs, toMs) {
  let tokens = 0;
  let spend = 0;
  let cacheRead = 0;
  let cacheCreate = 0;
  let prompts = 0;
  let corrections = 0;
  for (const e of events) {
    const t = eventTime(e);
    if (t == null || t < fromMs || t >= toMs) continue;
    if (e.kind === 'assistant' && e.usage) {
      tokens += usageTokens(e);
      spend += costForEvent(e);
      cacheRead += e.usage.cacheReadInputTokens;
      cacheCreate += e.usage.cacheCreationInputTokens;
    } else if (e.isHumanPrompt && e.humanText) {
      // Approximation: inside a window every marker match counts as a
      // correction (no first-prompt exemption like the live aggregator).
      if (isCorrection(e.humanText)) corrections += 1;
      else prompts += 1;
    }
  }
  const cacheDen = cacheRead + cacheCreate;
  const oneDen = prompts + corrections;
  return {
    tokens,
    spend,
    cacheHitRate: cacheDen > 0 ? cacheRead / cacheDen : null,
    oneShotRate: oneDen > 0 ? prompts / oneDen : null,
  };
}

function ratioDelta(cur, prev, { goodWhenDown }) {
  if (!(prev > 0)) return null;
  const r = cur / prev;
  if (r >= 0.99 && r <= 1.01) return null; // noise floor: within 1%
  const dir = r > 1 ? 'up' : 'down';
  const text = r >= 2 ? `${r.toFixed(1)}\u00d7` : `${Math.abs(Math.round((r - 1) * 100))}%`;
  return { dir, text, good: goodWhenDown ? dir === 'down' : dir === 'up' };
}

function pointDelta(cur, prev, { goodWhenUp }) {
  if (cur == null || prev == null) return null;
  const pts = Math.round((cur - prev) * 100);
  if (Math.abs(pts) < 1) return null;
  const dir = pts > 0 ? 'up' : 'down';
  return { dir, text: `${Math.abs(pts)}pt`, good: goodWhenUp ? dir === 'up' : dir === 'down' };
}

function weekOverWeek(events, { now } = {}) {
  const clock = now ? now() : new Date();
  const nowMs = clock.getTime();
  const cur = windowStats(events, nowMs - WEEK_MS, nowMs);
  const prev = windowStats(events, nowMs - 2 * WEEK_MS, nowMs - WEEK_MS);
  return {
    burn: ratioDelta(cur.tokens, prev.tokens, { goodWhenDown: true }),
    spend: ratioDelta(cur.spend, prev.spend, { goodWhenDown: true }),
    cacheHit: pointDelta(cur.cacheHitRate, prev.cacheHitRate, { goodWhenUp: true }),
    oneShot: pointDelta(cur.oneShotRate, prev.oneShotRate, { goodWhenUp: true }),
  };
}

function forecastMonth(events, { monthBudgetTokens, now } = {}) {
  const clock = now ? now() : new Date();
  const monthStartMs = new Date(clock.getFullYear(), clock.getMonth(), 1).getTime();
  const daysInMonth = new Date(clock.getFullYear(), clock.getMonth() + 1, 0).getDate();
  const daysElapsed = clock.getDate(); // >= 1, no div-by-zero
  let spend = 0;
  let tokens = 0;
  for (const e of events) {
    if (e.kind !== 'assistant' || !e.usage) continue;
    const t = eventTime(e);
    if (t == null || t < monthStartMs || t > clock.getTime()) continue;
    spend += costForEvent(e);
    tokens += usageTokens(e);
  }
  const proj = (spend / daysElapsed) * daysInMonth;
  const projTokens = (tokens / daysElapsed) * daysInMonth;
  const over = monthBudgetTokens > 0 && projTokens > monthBudgetTokens;
  const status = over
    ? `${Math.max(1, Math.round((projTokens / monthBudgetTokens - 1) * 100))}% over cap`
    : 'within budget';
  return { proj, projTokens, over, status, note: `projected month-end \u00b7 ${daysInMonth - daysElapsed} days left` };
}

module.exports = {
  eventTime, usageTokens, projectName, burnSeries, spendByProject,
  sessionHistory, modelSplit, weekOverWeek, forecastMonth,
};
