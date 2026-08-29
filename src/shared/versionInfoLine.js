// src/shared/versionInfoLine.js
// One line, for the COPY VERSION INFO button in the footer popover and the Settings
// block. docs/design/aether-convergence-plan.md sets the shape:
//
//   Token Tracker v2.1.7 (build a3f9c21) · seat MGRANT · Windows 11 Home · built 28 Jul 2026
//
// The product name leads because of the failure mode the feature exists for: asked
// which version they are on, a user reads back the Claude Code version by mistake. A
// pasted line that names itself cannot be misread that way.
//
// Pure, no Electron and no `os` import: the caller supplies seat and OS. That keeps it
// testable and keeps the renderer out of the business of knowing who is logged in.

const DEFAULT_PRODUCT_NAME = 'Token Tracker';
const SEPARATOR = ' · '; // middle dot, per the convergence plan's specimen line
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// UTC, deliberately. builtAt is an instant; rendering it in the reader's local zone
// means two people pasting lines from the same build can disagree about which day it
// was cut, which is the opposite of what a version readout is for.
function formatBuiltAt(builtAt) {
  if (typeof builtAt !== 'string') return null;
  const ms = Date.parse(builtAt);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// 'unknown' is buildInfo.js's documented absent value, not a commit. Printing
// "(build unknown)" would be noise in a line whose job is to be skimmed.
function buildSegment(commit) {
  return typeof commit === 'string' && commit.length > 0 && commit !== 'unknown'
    ? ` (build ${commit})`
    : '';
}

function versionInfoLine({
  productName = DEFAULT_PRODUCT_NAME,
  version,
  commit,
  builtAt,
  seat,
  os,
} = {}) {
  const head = `${productName} v${version}${buildSegment(commit)}`;
  const built = formatBuiltAt(builtAt);
  const tail = [
    seat ? `seat ${seat}` : null,
    os || null,
    built ? `built ${built}` : null,
  ].filter(Boolean);
  return [head, ...tail].join(SEPARATOR);
}

module.exports = { versionInfoLine, DEFAULT_PRODUCT_NAME };
