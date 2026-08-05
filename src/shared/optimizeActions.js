// src/shared/optimizeActions.js
// Pure logic for turning an Optimize finding into a guidance line inside a
// managed marked block in a CLAUDE.md. No fs, no Electron - unit-testable.

const MANAGED_BEGIN = '<!-- token-tracker:begin -->';
const MANAGED_END = '<!-- token-tracker:end -->';
const HEADING = '## Token Tracker suggestions';

// One stable, file-list-free guidance line per rule id.
const GUIDANCE_BY_ID = {
  'opus-on-trivial-turns':
    'Prefer Sonnet for short/trivial turns; reserve Opus for complex reasoning.',
  'unpinned-config-re-reads':
    'Pin frequently re-read files into context instead of re-reading them each turn.',
  'uncapped-bash-output':
    'Cap large command output (pipe through head/tail or Select-Object -First).',
};

function guidanceFor(findingId) {
  if (Object.prototype.hasOwnProperty.call(GUIDANCE_BY_ID, findingId)) {
    return GUIDANCE_BY_ID[findingId];
  }
  return null;
}

function buildBlock(guidance) {
  return `${MANAGED_BEGIN}\n${HEADING}\n- ${guidance}\n${MANAGED_END}`;
}

// isGuidanceApplied(content, findingId) -> boolean
// True only when the finding's guidance bullet sits inside the managed block.
function isGuidanceApplied(content, findingId) {
  const guidance = guidanceFor(findingId);
  if (guidance === null || !content) return false;

  const beginIdx = content.indexOf(MANAGED_BEGIN);
  const endIdx = content.indexOf(MANAGED_END);
  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) return false;

  const bullet = `- ${guidance}`;
  return content
    .slice(beginIdx, endIdx)
    .split('\n')
    .some((line) => line.trim() === bullet);
}

// upsertGuidance(content, findingId) -> { content, added }
// - unknown id: unchanged, added:false
// - no managed block: append one (blank line + block), preserving original bytes
// - managed block present, line absent: insert bullet before MANAGED_END
// - line already present: unchanged, added:false
function upsertGuidance(content, findingId) {
  const guidance = guidanceFor(findingId);
  if (guidance === null) {
    return { content, added: false };
  }

  const bullet = `- ${guidance}`;
  const beginIdx = content.indexOf(MANAGED_BEGIN);
  const endIdx = content.indexOf(MANAGED_END);
  const hasBlock = beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx;

  if (!hasBlock) {
    // Append a fresh block. Preserve the original content byte-for-byte as a prefix.
    let sep;
    if (content.length === 0) {
      sep = '';
    } else if (content.endsWith('\n')) {
      sep = '\n';
    } else {
      sep = '\n\n';
    }
    const nextContent = `${content}${sep}${buildBlock(guidance)}\n`;
    return { content: nextContent, added: true };
  }

  // Block present. Check whether this exact guidance is already a bullet inside it.
  const blockInner = content.slice(beginIdx, endIdx);
  const alreadyPresent = blockInner
    .split('\n')
    .some((line) => line.trim() === bullet);
  if (alreadyPresent) {
    return { content, added: false };
  }

  // Insert the bullet on its own line immediately before MANAGED_END. Everything
  // outside the inserted line is preserved byte-for-byte.
  const nextContent = `${content.slice(0, endIdx)}${bullet}\n${content.slice(endIdx)}`;
  return { content: nextContent, added: true };
}

module.exports = {
  MANAGED_BEGIN,
  MANAGED_END,
  HEADING,
  GUIDANCE_BY_ID,
  guidanceFor,
  upsertGuidance,
  isGuidanceApplied,
};
