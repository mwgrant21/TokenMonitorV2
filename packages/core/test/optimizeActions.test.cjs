// test/optimizeActions.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MANAGED_BEGIN,
  MANAGED_END,
  HEADING,
  GUIDANCE_BY_ID,
  guidanceFor,
  upsertGuidance,
  isGuidanceApplied,
} = require('../dist/cjs/optimizeActions.cjs');

const KNOWN_ID = 'opus-on-trivial-turns';
const KNOWN_GUIDANCE = GUIDANCE_BY_ID[KNOWN_ID];
const OTHER_ID = 'uncapped-bash-output';
const OTHER_GUIDANCE = GUIDANCE_BY_ID[OTHER_ID];

test('constants have the exact spec values', () => {
  assert.equal(MANAGED_BEGIN, '<!-- token-tracker:begin -->');
  assert.equal(MANAGED_END, '<!-- token-tracker:end -->');
  assert.equal(HEADING, '## Token Tracker suggestions');
});

test('GUIDANCE_BY_ID has the three exact strings', () => {
  assert.equal(
    GUIDANCE_BY_ID['opus-on-trivial-turns'],
    'Prefer Sonnet for short/trivial turns; reserve Opus for complex reasoning.'
  );
  assert.equal(
    GUIDANCE_BY_ID['unpinned-config-re-reads'],
    'Pin frequently re-read files into context instead of re-reading them each turn.'
  );
  assert.equal(
    GUIDANCE_BY_ID['uncapped-bash-output'],
    'Cap large command output (pipe through head/tail or Select-Object -First).'
  );
});

test('guidanceFor returns the string for a known id and null for unknown', () => {
  assert.equal(guidanceFor(KNOWN_ID), KNOWN_GUIDANCE);
  assert.equal(guidanceFor('no-such-id'), null);
  assert.equal(guidanceFor(undefined), null);
});

test('empty content -> creates a block with heading + bullet, added:true', () => {
  const { content, added } = upsertGuidance('', KNOWN_ID);
  assert.equal(added, true);
  assert.ok(content.includes(MANAGED_BEGIN));
  assert.ok(content.includes(HEADING));
  assert.ok(content.includes(`- ${KNOWN_GUIDANCE}`));
  assert.ok(content.includes(MANAGED_END));
  // begin precedes bullet precedes end
  assert.ok(content.indexOf(MANAGED_BEGIN) < content.indexOf(`- ${KNOWN_GUIDANCE}`));
  assert.ok(content.indexOf(`- ${KNOWN_GUIDANCE}`) < content.indexOf(MANAGED_END));
});

test('content without a block -> appends the block and preserves original content', () => {
  const original = '# My Project\n\nSome existing notes.\n';
  const { content, added } = upsertGuidance(original, KNOWN_ID);
  assert.equal(added, true);
  // Original preserved byte-for-byte as a prefix.
  assert.ok(content.startsWith(original));
  assert.ok(content.includes(MANAGED_BEGIN));
  assert.ok(content.includes(`- ${KNOWN_GUIDANCE}`));
  assert.ok(content.includes(MANAGED_END));
});

test('content WITH a block missing this line -> inserts the bullet before MANAGED_END, added:true', () => {
  const original = [
    '# My Project',
    '',
    MANAGED_BEGIN,
    HEADING,
    `- ${OTHER_GUIDANCE}`,
    MANAGED_END,
    '',
    'Trailing user content.',
    '',
  ].join('\n');

  const { content, added } = upsertGuidance(original, KNOWN_ID);
  assert.equal(added, true);
  // Both bullets present.
  assert.ok(content.includes(`- ${OTHER_GUIDANCE}`));
  assert.ok(content.includes(`- ${KNOWN_GUIDANCE}`));
  // New bullet sits before the end marker.
  assert.ok(content.indexOf(`- ${KNOWN_GUIDANCE}`) < content.indexOf(MANAGED_END));
  // Content outside the block is preserved.
  assert.ok(content.startsWith('# My Project'));
  assert.ok(content.includes('Trailing user content.'));
});

test('idempotency: re-applying the same id -> added:false and content unchanged', () => {
  const first = upsertGuidance('', KNOWN_ID);
  const second = upsertGuidance(first.content, KNOWN_ID);
  assert.equal(second.added, false);
  assert.equal(second.content, first.content);
});

test('unknown id -> added:false and content unchanged', () => {
  const original = '# Whatever\n';
  const { content, added } = upsertGuidance(original, 'not-a-real-id');
  assert.equal(added, false);
  assert.equal(content, original);
});

test('isGuidanceApplied: true only when the bullet is inside the managed block', () => {
  // Empty / no block -> false.
  assert.equal(isGuidanceApplied('', KNOWN_ID), false);
  assert.equal(isGuidanceApplied('# Notes\nUnrelated content.\n', KNOWN_ID), false);

  // Applied via upsertGuidance -> true for that id, false for others.
  const { content } = upsertGuidance('# My Project\n', KNOWN_ID);
  assert.equal(isGuidanceApplied(content, KNOWN_ID), true);
  assert.equal(isGuidanceApplied(content, OTHER_ID), false);

  // Unknown id -> false.
  assert.equal(isGuidanceApplied(content, 'no-such-id'), false);
});

test('isGuidanceApplied: bullet text OUTSIDE the managed block does not count', () => {
  const outside = `# My Project\n- ${KNOWN_GUIDANCE}\n`;
  assert.equal(isGuidanceApplied(outside, KNOWN_ID), false);
});

test('a different finding into an existing block -> both bullets present', () => {
  const step1 = upsertGuidance('', KNOWN_ID);
  const step2 = upsertGuidance(step1.content, OTHER_ID);
  assert.equal(step2.added, true);
  assert.ok(step2.content.includes(`- ${KNOWN_GUIDANCE}`));
  assert.ok(step2.content.includes(`- ${OTHER_GUIDANCE}`));
  // Only one managed block.
  assert.equal(step2.content.split(MANAGED_BEGIN).length - 1, 1);
  assert.equal(step2.content.split(MANAGED_END).length - 1, 1);
});
