// Managed-block writer for CLAUDE.md guidance lines. Pure string logic:
// everything outside the inserted line is preserved byte for byte.
export const MANAGED_BEGIN = '<!-- token-tracker:begin -->';
export const MANAGED_END = '<!-- token-tracker:end -->';
export const HEADING = '## Token Tracker suggestions';

export const GUIDANCE_BY_ID: Record<string, string> = {
  'opus-on-trivial-turns':
    'Prefer Sonnet for short/trivial turns; reserve Opus for complex reasoning.',
  'unpinned-config-re-reads':
    'Pin frequently re-read files into context instead of re-reading them each turn.',
  'uncapped-bash-output':
    'Cap large command output (pipe through head/tail or Select-Object -First).',
  'cost-of-thrash':
    'Cache file contents across turns instead of re-reading or re-writing the same file repeatedly.',
};

export function guidanceFor(findingId: string | undefined | null): string | null {
  if (findingId != null && Object.prototype.hasOwnProperty.call(GUIDANCE_BY_ID, findingId)) {
    return GUIDANCE_BY_ID[findingId];
  }
  return null;
}

function buildBlock(guidance: string): string {
  return `${MANAGED_BEGIN}\n${HEADING}\n- ${guidance}\n${MANAGED_END}`;
}

export function isGuidanceApplied(content: string, findingId: string): boolean {
  const guidance = guidanceFor(findingId);
  if (guidance === null || !content) return false;
  const beginIdx = content.indexOf(MANAGED_BEGIN);
  const endIdx = content.indexOf(MANAGED_END);
  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) return false;
  const bullet = `- ${guidance}`;
  return content.slice(beginIdx, endIdx).split('\n').some((line) => line.trim() === bullet);
}

// upsertGuidance(content, findingId) -> { content, added }
// - unknown id: unchanged, added:false
// - no managed block: append one (blank line + block), preserving original bytes
// - managed block present, line absent: insert bullet before MANAGED_END
// - line already present: unchanged, added:false
export function upsertGuidance(content: string, findingId: string): { content: string; added: boolean } {
  const guidance = guidanceFor(findingId);
  if (guidance === null) return { content, added: false };

  const bullet = `- ${guidance}`;
  const beginIdx = content.indexOf(MANAGED_BEGIN);
  const endIdx = content.indexOf(MANAGED_END);
  const hasBlock = beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx;

  if (!hasBlock) {
    // Append a fresh block. Preserve the original content byte-for-byte as a prefix.
    let sep: string;
    if (content.length === 0) sep = '';
    else if (content.endsWith('\n')) sep = '\n';
    else sep = '\n\n';
    return { content: `${content}${sep}${buildBlock(guidance)}\n`, added: true };
  }

  // Block present. Check whether this exact guidance is already a bullet inside it.
  const alreadyPresent = content.slice(beginIdx, endIdx).split('\n').some((line) => line.trim() === bullet);
  if (alreadyPresent) return { content, added: false };

  // Insert the bullet on its own line immediately before MANAGED_END. Everything
  // outside the inserted line is preserved byte-for-byte.
  return { content: `${content.slice(0, endIdx)}${bullet}\n${content.slice(endIdx)}`, added: true };
}
