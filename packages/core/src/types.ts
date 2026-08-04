// The transcript-event shape these rules consume.
//
// Owned by core deliberately. Aether OS previously imported TranscriptEvent from
// `electron/transcriptParser`, which coupled pure logic to the Electron main
// process and made the module unusable from the renderer or from TokenMonitor.
// Both apps now structurally satisfy this interface; neither owns it.
export interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  toolUseId: string;
  resultLength?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface TranscriptEvent {
  kind: 'assistant' | 'user' | string;
  model?: string | null;
  usage?: Usage | null;
  toolUses?: ToolUse[];
  toolResults?: ToolResult[];
  /** Date in Aether; ISO string in TokenMonitor's JSONL reads. Both are handled. */
  timestamp?: Date | string | null;
}

/**
 * Timestamp normalisation, and the reason this function exists in exactly one place.
 *
 * Aether's copy was `e.timestamp ? e.timestamp.getTime() : NaN` — which assumes a
 * Date and THROWS on a string. TokenMonitor's copy coerced strings and guarded a
 * null event. TokenMonitor reads timestamps straight out of JSONL, where they are
 * strings, so adopting Aether's version would have silently broken the optimize
 * recurrence check (`evaluateOptimizeRulesWithRecurrence`) on every real TokenMonitor
 * transcript — the same class of divergence as the usageTokens() cache-token bug.
 * TokenMonitor's defensive version is the one that survives. Do not "simplify" it.
 */
export function eventTimestampMs(e: TranscriptEvent | null | undefined): number {
  if (!e || !e.timestamp) return NaN;
  return e.timestamp instanceof Date ? e.timestamp.getTime() : new Date(e.timestamp).getTime();
}
