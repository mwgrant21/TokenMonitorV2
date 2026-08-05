const { costForEvent } = require('./modelPricing');

const CORRECTION_MARKERS = ['no,', 'wrong', 'fix', 'actually', 'revert', "that's not", 'undo'];

function isCorrection(text) {
  const lower = String(text || '').toLowerCase();
  return CORRECTION_MARKERS.some((m) => lower.includes(m));
}

class UsageAggregator {
  constructor({ now } = {}) {
    this._now = now || (() => new Date());
    this.events = []; // assistant events that carry usage
    this.openAgentCalls = new Map(); // toolUseId -> {id, description, subagentType, startedAt, tokens}
    this.oneShotEligiblePromptCount = 0;
    this.correctionCount = 0;
    this._seenAnyHumanPrompt = false;
  }

  ingest(event) {
    if (!event) return;

    if (event.kind === 'assistant') {
      if (event.usage) {
        this.events.push({ timestamp: event.timestamp, model: event.model, usage: event.usage });
        // Proxy for per-agent consumption: subagent sidechain transcripts are not
        // tailed, so attribute the main transcript's input+output tokens to every
        // agent call open while the event arrived. Monotonic; catches runaways.
        const eventTokens = event.usage.inputTokens + event.usage.outputTokens;
        for (const call of this.openAgentCalls.values()) {
          call.tokens += eventTokens;
        }
      }
      for (const toolUse of event.toolUses) {
        if (toolUse.name === 'Agent') {
          this.openAgentCalls.set(toolUse.id, {
            id: toolUse.id,
            description: toolUse.input && toolUse.input.description,
            subagentType: toolUse.input && toolUse.input.subagent_type,
            startedAt: event.timestamp,
            tokens: 0,
          });
        }
      }
    } else if (event.kind === 'user') {
      for (const result of event.toolResults) {
        this.openAgentCalls.delete(result.toolUseId);
      }
      if (event.isHumanPrompt) {
        this._registerHumanPrompt(event);
      }
    }
  }

  _registerHumanPrompt(event) {
    const correction = this._seenAnyHumanPrompt && isCorrection(event.humanText);
    if (correction) {
      this.correctionCount += 1;
    } else {
      this.oneShotEligiblePromptCount += 1;
    }
    this._seenAnyHumanPrompt = true;
  }

  getRunningAgents() {
    return Array.from(this.openAgentCalls.values());
  }

  _eventsSince(sinceMs) {
    if (sinceMs == null) return this.events;
    const cutoff = this._now().getTime() - sinceMs;
    return this.events.filter((e) => e.timestamp && e.timestamp.getTime() >= cutoff);
  }

  getBurnRate(windowMs = 5 * 60 * 1000) {
    const recent = this._eventsSince(windowMs);
    const totalTokens = recent.reduce(
      (sum, e) => sum + e.usage.inputTokens + e.usage.outputTokens + e.usage.cacheCreationInputTokens + e.usage.cacheReadInputTokens,
      0
    );
    return totalTokens / (windowMs / 60000);
  }

  getTotals(sinceMs) {
    const events = this._eventsSince(sinceMs);
    return events.reduce(
      (acc, e) => {
        acc.inputTokens += e.usage.inputTokens;
        acc.outputTokens += e.usage.outputTokens;
        acc.cacheCreationInputTokens += e.usage.cacheCreationInputTokens;
        acc.cacheReadInputTokens += e.usage.cacheReadInputTokens;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }
    );
  }

  getSpend(sinceMs) {
    const events = this._eventsSince(sinceMs);
    return events.reduce((sum, e) => sum + costForEvent(e), 0);
  }

  getCacheHitRate(sinceMs) {
    const totals = this.getTotals(sinceMs);
    const cacheable = totals.cacheReadInputTokens + totals.cacheCreationInputTokens;
    if (cacheable === 0) return 0;
    return totals.cacheReadInputTokens / cacheable;
  }

  getOneShotRate() {
    const total = this.oneShotEligiblePromptCount + this.correctionCount;
    if (total === 0) return null;
    return this.oneShotEligiblePromptCount / total;
  }
}

module.exports = { UsageAggregator, isCorrection };
