// src/shared/taskClassifier.js
//
// v1 heuristic, confirmed approximate-is-fine: classifies a single assistant
// event by the tools it used. Real turns span multiple assistant events; this
// classifies at the individual-event level and callers aggregate per turn/session.
function classifyEvent(event) {
  if (!event || event.kind !== 'assistant' || !event.toolUses || event.toolUses.length === 0) {
    return null;
  }

  const names = event.toolUses.map((t) => t.name);
  const bashCommands = event.toolUses
    .filter((t) => t.name === 'Bash')
    .map((t) => (t.input && t.input.command) || '');

  if (bashCommands.some((c) => /pytest|jest|npm test|go test|dotnet test/i.test(c))) {
    return 'Testing';
  }
  if (bashCommands.some((c) => /debug|traceback|stacktrace/i.test(c))) {
    return 'Debugging';
  }
  if (names.some((n) => n === 'Edit' || n === 'Write' || n === 'MultiEdit')) {
    return 'Coding';
  }
  if (names.some((n) => n === 'Grep' || n === 'Glob' || n === 'Read')) {
    return 'Exploration';
  }
  return 'Exploration';
}

// Shared by Task 14 (dashboard IPC) and Task 17 (fleet snapshot writer) — the
// one place category-rollup logic lives, so it isn't redefined per consumer.
function buildTaskBreakdown(events) {
  const byCategory = new Map();
  for (const e of events) {
    const category = classifyEvent(e);
    if (!category || !e.usage) continue;
    const tokens = e.usage.inputTokens + e.usage.outputTokens + e.usage.cacheCreationInputTokens + e.usage.cacheReadInputTokens;
    byCategory.set(category, (byCategory.get(category) || 0) + tokens);
  }
  return Array.from(byCategory.entries())
    .map(([category, tokens]) => ({ category, tokens }))
    .sort((a, b) => b.tokens - a.tokens);
}

module.exports = { classifyEvent, buildTaskBreakdown };
