// test/noAutoUpdate.test.js
// Guards the decision in docs/design/2026-08-05-app-move-and-aether-reskin.md section 5:
// rollout is manual, so no updater and no bundled credential may reappear.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['src', 'scripts'];
// Case-insensitive and deliberately loose: `autoupdate` catches `autoUpdater`,
// `initAutoUpdate` and `require('./autoUpdate')` alike. A stricter /autoUpdater/
// would miss main.js's call site entirely.
const BANNED = [/electron-updater/i, /autoupdate/i, /update-token/i];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

test('no source file references the auto-updater or a bundled update token', () => {
  const files = SCAN_DIRS
    .map((d) => path.join(ROOT, d))
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => walk(d, []));

  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of BANNED) {
      if (pattern.test(text)) hits.push(`${path.relative(ROOT, file)}: ${pattern}`);
    }
  }
  assert.deepStrictEqual(hits, [], `auto-updater references found:\n${hits.join('\n')}`);
});

test('electron-builder.yml bundles no extraResources and publishes nowhere', () => {
  const yml = fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf8');
  assert.ok(!/extraResources/.test(yml), 'extraResources must not be present');
  assert.ok(!/^publish:/m.test(yml), 'publish block must not be present');
});

test('electron-updater is not a dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.strictEqual(all['electron-updater'], undefined);
});
