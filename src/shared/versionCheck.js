// src/shared/versionCheck.js
// Pure version comparison + rollout status. No fs, no Electron, no network.
//
// Rollout is manual: a `latest.json` dropped into the shared fleet folder is the
// only thing that says what the current build is. Nothing here reaches the
// network; the caller reads a local file off a share it already reads.

// Parse "2.1.7" / "v2.1.7" / "2.1.7+a3f9c21" -> [2,1,7], or null if unparseable.
// Build metadata after '+' and prerelease after '-' are ignored for ordering:
// this is a "are you behind" check, not a full semver implementation.
function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^v/i, '').split('+')[0].split('-')[0];
  if (!/^\d+(\.\d+){0,2}$/.test(cleaned)) return null;
  const parts = cleaned.split('.').map((n) => Number.parseInt(n, 10));
  while (parts.length < 3) parts.push(0);
  return parts;
}

// -1 if a < b, 0 if equal, 1 if a > b. Returns null if either is unparseable,
// so callers can distinguish "behind" from "cannot tell" rather than guessing.
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

// deriveVersionStatus(current, latest) -> { state, current, latest, behindBy }
//   'current'  - running the published build (or ahead of it, e.g. a local dev build)
//   'behind'   - a newer build has been published; behindBy names the bump size
//   'unknown'  - no latest.json, or either version is unparseable
// 'unknown' is deliberately its own state and must never render as 'current':
// a missing or malformed latest.json means we do not know, and silently
// claiming "up to date" is exactly the failure mode this feature exists to avoid.
function deriveVersionStatus(current, latest) {
  const cmp = compareVersions(current, latest);
  if (cmp === null) {
    return { state: 'unknown', current: current || null, latest: latest || null, behindBy: null };
  }
  if (cmp >= 0) {
    return { state: 'current', current, latest, behindBy: null };
  }
  const pc = parseVersion(current);
  const pl = parseVersion(latest);
  let behindBy = 'patch';
  if (pl[0] > pc[0]) behindBy = 'major';
  else if (pl[1] > pc[1]) behindBy = 'minor';
  return { state: 'behind', current, latest, behindBy };
}

module.exports = { parseVersion, compareVersions, deriveVersionStatus };
