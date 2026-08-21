// src/shared/transcriptParser.js

// Size of a tool result's payload, in characters. findUncappedBashOutput in
// @tokenmonitor/core compares this against its 5000-char threshold; before this
// existed the rule read undefined, evaluated 0, and could never fire - the rule
// body was correct, its input was missing (docs/follow-ups.md item 1). Content
// arrives either as a plain string or as an array of blocks (both shapes are in
// test/fixtures); non-text blocks such as images contribute no characters.
function toolResultLength(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce(
    (sum, block) => sum + (block && typeof block.text === 'string' ? block.text.length : 0),
    0,
  );
}

function parseTranscriptLine(rawLine) {
  const trimmed = (rawLine || '').trim();
  if (!trimmed) return null;

  let json;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const sessionId = json.sessionId || json.session_id || null;
  const timestamp = json.timestamp ? new Date(json.timestamp) : null;
  const cwd = json.cwd || null;

  if (json.type === 'assistant' && json.message) {
    const msg = json.message;
    const content = Array.isArray(msg.content) ? msg.content : [];
    const toolUses = content
      .filter((item) => item.type === 'tool_use')
      .map((item) => ({ id: item.id, name: item.name, input: item.input }));
    const usage = msg.usage
      ? {
          inputTokens: msg.usage.input_tokens || 0,
          outputTokens: msg.usage.output_tokens || 0,
          cacheCreationInputTokens: msg.usage.cache_creation_input_tokens || 0,
          cacheReadInputTokens: msg.usage.cache_read_input_tokens || 0,
        }
      : null;
    return {
      kind: 'assistant',
      sessionId,
      timestamp,
      cwd,
      model: msg.model || null,
      usage,
      toolUses,
      toolResults: [],
      isHumanPrompt: false,
      humanText: null,
    };
  }

  if (json.type === 'user' && json.message) {
    const msg = json.message;
    const content = Array.isArray(msg.content)
      ? msg.content
      : typeof msg.content === 'string'
        ? [{ type: 'text', text: msg.content }]
        : [];
    const toolResults = content
      .filter((item) => item.type === 'tool_result')
      .map((item) => ({ toolUseId: item.tool_use_id, resultLength: toolResultLength(item.content) }));
    const textItem = content.find((item) => item.type === 'text');
    const isHumanPrompt = toolResults.length === 0 && !!textItem;
    return {
      kind: 'user',
      sessionId,
      timestamp,
      cwd,
      model: null,
      usage: null,
      toolUses: [],
      toolResults,
      isHumanPrompt,
      humanText: textItem ? textItem.text : null,
    };
  }

  return {
    kind: 'other',
    sessionId,
    timestamp,
    cwd,
    model: null,
    usage: null,
    toolUses: [],
    toolResults: [],
    isHumanPrompt: false,
    humanText: null,
  };
}

module.exports = { parseTranscriptLine };
