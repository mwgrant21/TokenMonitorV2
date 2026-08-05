# App Move (Phases 0-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the v1 Electron application into this repo unchanged, retire the auto-updater, and
make the app consume `@tokenmonitor/core` instead of its own duplicated copies of four modules.

**Architecture:** The app becomes the root package of this npm workspace. v1 has no bundler and no
build step — the renderer is plain `<script>` tags loaded in dependency order — so the transplant is
a file copy, not a migration. `@tokenmonitor/core` then resolves as a workspace dependency rather
than the absolute `file:` path v1's in-progress branch uses.

**Tech Stack:** Electron 43, CommonJS main process, vanilla-JS renderer, `node --test`,
electron-builder (NSIS), npm workspaces.

**Source spec:** [`docs/design/2026-08-05-app-move-and-aether-reskin.md`](../design/2026-08-05-app-move-and-aether-reskin.md), phases 0-2.

## Global Constraints

- **Node 22+ required.** `node --test` glob patterns need Node 21+, and node-abi (node-pty prebuild
  resolution) requires >= 22.12. CI matrix is `['22.x', '24.x']`.
- **The application is CommonJS.** Every `src/` file uses `require()`. `@tokenmonitor/core` resolves
  to `./dist/cjs/index.cjs` via its `main` field, so `require('@tokenmonitor/core')` works. Do not
  convert anything to ESM.
- **No bundler.** The renderer loads via `<script>` tags off the filesystem. Do not add one.
- **Phase 0 must be provably a no-op.** Task 1 changes no application behaviour. If a step tempts you
  to fix, tidy or rename something, don't — it belongs in a later task.
- **`secrets/` never moves.** It is gitignored in v1 and contains a live credential. Task 1's copy
  mechanism moves only git-tracked files, which structurally excludes it. Do not work around this.
- **Zero API cost.** Nothing in this repo may reach a model API. No task here adds a network call.
- **Write all files as UTF-8 without BOM.** ASCII only in source and config.
- **Shell:** commands below are written for Git Bash (the `Bash` tool). `~` resolves to
  `C:/Users/IT`. Run them from the repo root unless stated otherwise.

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `src/main/**` | Electron main process (15 files from v1 + existing `latestVersionReader.js`) | 1 |
| `src/preload/preload.js` | Context bridge | 1 |
| `src/renderer/**` | Vanilla-JS renderer: `index.html`, `dashboard/`, `fleet/`, `terminal/` | 1 |
| `src/shared/**` | Pure logic shared by main and tests (22 files from v1 + existing `versionCheck.js`) | 1 |
| `test/**` | 32 v1 suites + 4 fixtures, merged with the 2 existing suites | 1 |
| `scripts/**` | `dist.js`, `grant-appcontainer-acl.js`, `capture-usage-fixture.js`, 2 `.ps1` helpers | 1 |
| `build/**` | `icon.png`, `installer.nsh` | 1 |
| `electron-builder.yml` | NSIS packaging config | 1, 2 |
| `.github/workflows/ci.yml` | CI: windows-latest, Node 22/24 | 1 |
| `package.json` | Root: app entry point + workspace host | 1, 2, 3 |
| `.gitignore` | Gains v1's ignores (`secrets/`, `codesign/`, `.worktrees/`, `*.log`) | 1 |
| `test/noAutoUpdate.test.js` | **New.** Regression guard: the updater cannot come back | 2 |
| `test/coreContract.test.js` | **New.** Guard: core exports every binding the app needs | 3 |

**No filename collisions exist.** v1's `src/main/` has no `latestVersionReader.js`, its `src/shared/`
has no `versionCheck.js`, and its `test/` has neither existing suite. Verified 2026-08-05.

---

### Task 1: Transplant the application, unchanged

**Files:**
- Create: everything under `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`, `test/`,
  `scripts/`, `build/`, `.github/workflows/ci.yml`, `electron-builder.yml`, `budgets.default.json`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Electron app at repo root. `npm start` launches it; `npm test` runs 34
  `test/*.test.js` suites plus the `@tokenmonitor/core` workspace suite.

- [ ] **Step 1: Confirm the v1 source repo is clean before copying**

```bash
git -C ~/claude-token-tracker status --porcelain
git -C ~/claude-token-tracker rev-parse --short HEAD
```

Expected: no output from the first command (clean tree), and a short SHA from the second. **Record
that SHA** — it goes in the commit message so the transplant's provenance is exact.

If the tree is not clean, stop and report. Do not copy a dirty tree.

- [ ] **Step 2: Copy only git-tracked files across**

`git archive` emits the tracked tree at HEAD, so untracked and ignored paths — including
`secrets/update-token.txt` — cannot come along. This is the mechanism that enforces the
"`secrets/` never moves" constraint.

```bash
cd ~/claude-token-tracker
git archive HEAD src test scripts build .github budgets.default.json electron-builder.yml \
  | tar -x -C ~/Desktop/TokenMonitorV2
```

- [ ] **Step 3: Verify the copy landed and no credential came with it**

```bash
cd ~/Desktop/TokenMonitorV2
ls src/main/ | wc -l          # expect 16  (15 from v1 + latestVersionReader.js)
ls src/shared/ | wc -l        # expect 23  (22 from v1 + versionCheck.js)
ls test/*.test.js | wc -l     # expect 34  (32 from v1 + 2 existing)
ls test/fixtures/ | wc -l     # expect 4
test -d secrets && echo "FAIL: secrets/ present" || echo "OK: no secrets/"
find . -name 'update-token*' -not -path './node_modules/*' | grep . && echo "FAIL" || echo "OK: no token file"
```

Expected: the four counts above, then `OK: no secrets/` and `OK: no token file`.

- [ ] **Step 4: Merge `package.json`**

Replace the whole file with this. It keeps v1's entry point, scripts and dependencies verbatim
(including `electron-updater` — removing it is Task 2, not this task) while preserving V2's identity,
`workspaces` block and `build:core` script.

```json
{
  "name": "tokenmonitor-v2",
  "version": "2.0.0-alpha.0",
  "private": true,
  "description": "Claude Token Tracker v2 — department build. Shared core logic, version readout, and the v2 design system.",
  "author": "Matt Grant",
  "main": "src/main/main.js",
  "workspaces": ["packages/*"],
  "scripts": {
    "start": "electron .",
    "postinstall": "node scripts/grant-appcontainer-acl.js",
    "test": "node --test \"test/*.test.js\" && npm test --workspace @tokenmonitor/core",
    "build:core": "npm run build --workspace @tokenmonitor/core",
    "dist": "node scripts/dist.js",
    "release": "node scripts/dist.js --publish"
  },
  "dependencies": {
    "electron-updater": "^6.8.9",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  },
  "devDependencies": {
    "electron": "^43.0.0",
    "electron-builder": "^26.15.3"
  }
}
```

- [ ] **Step 5: Merge `.gitignore`**

Replace the whole file. The first five lines are V2's existing ignores; the rest are v1's.

```
node_modules/
dist/
out/
*.tsbuildinfo
.env
.worktrees/
*.log
codesign/
secrets/
```

- [ ] **Step 6: Install and build the core package**

```bash
cd ~/Desktop/TokenMonitorV2
npm install
npm run build:core
```

Expected: install completes; `built 6 module(s) -> dist/esm (ESM) + dist/cjs (CJS)`.

`npm install` (not `npm ci`) is correct here — `package-lock.json` predates the app's dependencies
and must be regenerated. The updated lockfile is committed in Step 9.

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: **34 test files pass** from `test/`, then the `@tokenmonitor/core` workspace suite passes
(43 assertions). Zero failures.

If a suite fails, do not fix the test. Phase 0 is a no-op — a failure here means the copy is
incomplete or a path assumption is wrong. Report it.

- [ ] **Step 8: Verify the app actually launches and renders**

A passing test suite does not prove the Electron shell works. Launch it and confirm a real titled
window exists, then close it.

Run this with the **PowerShell** tool, not Bash — a foreground `sleep` in Bash is blocked by the
harness, and `Start-Process -PassThru` gives you the exit state for free:

```powershell
cd "$env:USERPROFILE\Desktop\TokenMonitorV2"
$p = Start-Process -FilePath "node_modules\.bin\electron.cmd" -ArgumentList "." -PassThru
Start-Sleep -Seconds 12
if ($p.HasExited) { "EXITED code $($p.ExitCode)" } else { "RUNNING" }
Get-Process -Name electron -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle } |
  Select-Object Id, MainWindowTitle, @{n='MB';e={[math]::Round($_.WorkingSet64/1MB)}}
```

Expected: `RUNNING`, then at least one row with `MainWindowTitle` reading `Claude Token Tracker` and
a non-trivial working set (roughly 150MB+). `EXITED`, no rows, or a row with an empty title all mean
the renderer failed to mount — report it rather than proceeding. A process that is alive with no
titled window is the signature of a renderer crash, not a slow start.

Close it:

```powershell
Stop-Process -Name electron -Force
```

- [ ] **Step 9: Commit**

Substitute the SHA recorded in Step 1.

```bash
cd ~/Desktop/TokenMonitorV2
git add -A
git commit -m "feat: transplant the v1 Electron application into this repo

Copied unchanged from mwgrant21/TokenMonitor at <SHA> via git archive, so
only tracked files moved and secrets/ could not follow.

The app becomes the root package of this workspace. No behaviour changes:
package.json keeps v1's entry point, scripts and dependencies verbatim,
including electron-updater, which is retired in the next commit.

Verified: 34 test/ suites plus the @tokenmonitor/core workspace suite pass,
and the app launches with a rendering window."
```

---

### Task 2: Retire the auto-updater

**Files:**
- Create: `test/noAutoUpdate.test.js`
- Delete: `src/main/autoUpdate.js`
- Modify: `src/main/main.js:17` and `:87`, `electron-builder.yml:10-18`, `scripts/dist.js:85-93`,
  `package.json`

**Interfaces:**
- Consumes: the runnable app from Task 1.
- Produces: no new runtime interface. Removes `initAutoUpdate({ app, getMainWindow })` from
  `src/main/autoUpdate.js`.

**Why this is not housekeeping:** `electron-builder.yml:10-12` copies `secrets/update-token.txt` into
every package via `extraResources`, and `autoUpdate.js:11` reads it back from
`process.resourcesPath`. A GitHub token therefore sits in plaintext in the install directory of every
deployed machine. The feature is unused because rollout is manual by decision.

- [ ] **Step 1: Write the failing regression test**

This test is the point of the task: it makes the removal permanent rather than merely done.

Create `test/noAutoUpdate.test.js`:

```js
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
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node --test test/noAutoUpdate.test.js
```

Expected: **all three tests FAIL.** The first lists at least `src/main/autoUpdate.js`,
`src/main/main.js` (its `initAutoUpdate` import and call) and `scripts/dist.js` (both the
`update-token.txt` path and the `electron-updater` mention in the comment at `:62`); the second
reports `extraResources must not be present`; the third reports the dependency.

If any test passes at this point, the test is not actually checking what it claims — fix the test
before continuing.

- [ ] **Step 3: Delete the updater module and its call site**

```bash
rm src/main/autoUpdate.js
```

In `src/main/main.js`, delete line 17 entirely:

```js
const { initAutoUpdate } = require('./autoUpdate');
```

and delete line 87 entirely:

```js
  initAutoUpdate({ app, getMainWindow: () => win });
```

Remove only those two lines. Leave surrounding code untouched.

- [ ] **Step 4: Strip the packaging config**

In `electron-builder.yml`, delete these nine lines (currently `:10-18`):

```yaml
extraResources:
  - from: secrets/update-token.txt
    to: update-token.txt
publish:
  provider: github
  owner: mwgrant21
  repo: TokenMonitor
  private: true
  releaseType: release
```

The file keeps `appId`, `productName`, `npmRebuild`, `directories`, `files`, `win` and `nsis`.

- [ ] **Step 5: Remove the entire publish path from the dist script**

Removing only the update token is not enough, for two reasons: the comment at `dist.js:62` contains
the literal string `electron-updater` and would keep failing the guard test, and once
`electron-builder.yml` has no `publish:` block the whole GitHub-release path is dead code that
cannot work.

Delete these from `scripts/dist.js`, identified by name because line numbers shift as you go:

| Delete | Currently at |
|---|---|
| `const https = require('https');` | `:3` |
| `const publish = process.argv.includes('--publish');` | `:6` |
| `const updateTokenFile = ...` | `:11` |
| `const publishTokenFile = ...` | `:12` |
| `const GITHUB_OWNER` and `const GITHUB_REPO` | `:14-15` |
| the whole `async function ensureRelease(...)` and its comment block | `:52-64+` |
| the `requireFile(updateTokenFile, ...)` call and its comment block | `:85-93` |
| the whole `if (publish) { ... }` block containing `env.GH_TOKEN` and `ensureRelease` | `:95-102` |
| `if (publish) args.push('--publish', 'always');` | `:106` |

Keep `requireFile` itself, the codesign checks (`pfxPasswordFile`), and the `spawnSync('npx',
['electron-builder'], ...)` call. Local packaging must still work.

- [ ] **Step 5a: Verify the script still parses and has no orphaned references**

```bash
node --check scripts/dist.js
grep -n -iE 'publish|https|GITHUB_|ensureRelease|updateToken' scripts/dist.js
```

Expected: `node --check` prints nothing (valid syntax), and the grep returns **no output**. Any hit
is a binding you deleted the definition of but left a use of, or vice versa.

- [ ] **Step 6: Drop the dependency and the release script**

In `package.json`, remove `"electron-updater": "^6.8.9",` from `dependencies` and remove the
`"release": "node scripts/dist.js --publish"` line from `scripts`.

Then:

```bash
npm install
```

Expected: `electron-updater` removed from the lockfile.

- [ ] **Step 7: Run the regression test and the full suite**

```bash
node --test test/noAutoUpdate.test.js
npm test
```

Expected: all three guard tests PASS, then the full suite passes — **35 test files** now
(34 + `noAutoUpdate.test.js`) plus the core workspace suite.

- [ ] **Step 8: Verify the app still launches**

PowerShell tool, same pattern as Task 1 Step 8:

```powershell
cd "$env:USERPROFILE\Desktop\TokenMonitorV2"
$p = Start-Process -FilePath "node_modules\.bin\electron.cmd" -ArgumentList "." -PassThru
Start-Sleep -Seconds 12
if ($p.HasExited) { "EXITED code $($p.ExitCode)" } else { "RUNNING" }
Get-Process -Name electron -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle } | Select-Object MainWindowTitle
Stop-Process -Name electron -Force
```

Expected: `RUNNING`, then `Claude Token Tracker`. Removing the updater must not affect startup —
`initAutoUpdate` was called during window creation, so a mistake here shows up as a failure to
launch rather than as a subtle bug.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix: retire the auto-updater and the credential it bundled

electron-builder.yml copied secrets/update-token.txt into every package
via extraResources and autoUpdate.js read it back from resourcesPath, so
a GitHub token sat in plaintext in the install directory of every
deployed machine. Rollout is manual by decision, so the feature was
unused and its exposure was pure cost.

Removes electron-updater, src/main/autoUpdate.js, its main.js call site,
the extraResources and publish blocks, the dist.js token requirement and
the release script.

test/noAutoUpdate.test.js makes this permanent: it fails if the
dependency, an autoUpdater reference or an update-token path reappears
in src/ or scripts/.

Does not rotate the token already present on deployed machines. That is
tracked as an open item in the design spec, section 5."
```

---

### Task 3: Add `@tokenmonitor/core` as a workspace dependency

**Files:**
- Create: `test/coreContract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: the app from Task 2.
- Produces: `require('@tokenmonitor/core')` resolves from any file under `src/`, exporting the ten
  bindings Task 4's consumers destructure: `costForEvent`, `pricingTierForModel`,
  `evaluateOptimizeRules`, `evaluateOptimizeRulesWithRecurrence`, `summarizeOptimize`,
  `gradeBreakdown`, `appliedSummary`, `guidanceFor`, `isGuidanceApplied` and `upsertGuidance`.

- [ ] **Step 1: Write the failing contract test**

This is not a duplicate of the package's own tests. Those check that the logic is correct; this
checks that the package still exports everything **this app** requires, so a future change inside
`packages/core` cannot quietly break the consumer.

Create `test/coreContract.test.js`:

```js
// test/coreContract.test.js
// Every binding src/ imports from @tokenmonitor/core. If a future change to
// packages/core drops or renames one of these, this fails here rather than at
// runtime in the packaged app.
const test = require('node:test');
const assert = require('node:assert');
const core = require('@tokenmonitor/core');

// Exactly the ten bindings src/ destructures after Task 4. The package also
// exports PRICING_PER_MILLION_TOKENS, BAD_THRESHOLD_PER_WEEK, RULES_BY_ID,
// GUIDANCE_BY_ID, eventTimestampMs, HEADING, MANAGED_BEGIN and MANAGED_END --
// deliberately not asserted here, because the app does not consume them. Only
// the deleted modules and their deleted tests did. Asserting them would make
// this a copy of the package's own API surface rather than a statement of what
// the app depends on.
const REQUIRED = [
  'costForEvent',
  'pricingTierForModel',
  'evaluateOptimizeRules',
  'evaluateOptimizeRulesWithRecurrence',
  'summarizeOptimize',
  'gradeBreakdown',
  'appliedSummary',
  'guidanceFor',
  'isGuidanceApplied',
  'upsertGuidance',
];

test('core exports every binding the app requires', () => {
  const missing = REQUIRED.filter((name) => typeof core[name] !== 'function');
  assert.deepStrictEqual(missing, [], `missing or non-callable exports: ${missing.join(', ')}`);
});

test('core resolves to the CJS build', () => {
  // require() of an ESM-only package throws ERR_REQUIRE_ESM, so reaching this
  // line at all proves the CJS entry point resolved.
  assert.strictEqual(typeof core.costForEvent, 'function');
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node --test test/coreContract.test.js
```

Expected: **FAIL** with `Cannot find module '@tokenmonitor/core'`. The dependency is not declared
yet, so npm has not linked it into root `node_modules`.

- [ ] **Step 3: Declare the workspace dependency**

In `package.json`, add `@tokenmonitor/core` to `dependencies` as the first entry:

```json
  "dependencies": {
    "@tokenmonitor/core": "*",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  },
```

`"*"` is correct for a workspace-local package: npm links `packages/core` directly rather than
resolving a version from a registry. Do **not** use a `file:` path — that is exactly the fragile
absolute-path wiring this move exists to remove.

```bash
npm install
```

Expected: `node_modules/@tokenmonitor/core` exists as a symlink to `packages/core`.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
node --test test/coreContract.test.js
```

Expected: both tests PASS.

If `Cannot find module '.../dist/cjs/index.cjs'` appears, the package has not been built in this
checkout — run `npm run build:core` and retry.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: declare @tokenmonitor/core as a workspace dependency

Resolved via the workspaces field rather than a file: path. v1's
in-progress wiring branch used file:C:/Users/IT/Desktop/... , an absolute
path containing one machine's home directory that cannot resolve on the
other two machines.

test/coreContract.test.js asserts all twelve bindings src/ needs are
exported, so a change inside packages/core fails here rather than at
runtime in the packaged app."
```

---

### Task 4: Consume the package and delete the duplicated modules

**Files:**
- Delete: `src/shared/modelPricing.js`, `src/shared/optimizeRules.js`, `src/shared/optimizeGrade.js`,
  `src/shared/optimizeActions.js`
- Delete: `test/modelPricing.test.js`, `test/optimizeRules.test.js`, `test/optimizeGrade.test.js`,
  `test/optimizeActions.test.js`
- Modify: `src/shared/aggregator.js:1`, `src/shared/exportReport.js:5`,
  `src/shared/historyAggregator.js:5`, `src/main/fleetSnapshotWriter.js:5`,
  `src/main/ipcHandlers.js:9-11`, `src/main/optimizeActionHandlers.js:6`

**Interfaces:**
- Consumes: `@tokenmonitor/core` from Task 3.
- Produces: no `src/shared/` module named `modelPricing`, `optimizeRules`, `optimizeGrade` or
  `optimizeActions`. All twelve bindings come from the package.

**Why the four test files are deleted rather than repointed:** `packages/core/test/` already contains
these exact suites, ported during the extraction (`modelPricing.test.cjs`, `optimizeRules.test.cjs`,
`optimizeGrade.test.cjs`, `optimizeActions.test.cjs`, 43 assertions, run by the root `npm test` via
the workspace). Keeping a second copy in `test/` recreates the two-copies-drift problem that
`packages/core` exists to solve. Behaviour coverage moves to the package; the app keeps
`coreContract.test.js` for the wiring, and `aggregator`, `exportReport` and `historyAggregator`
suites still exercise `costForEvent` through their own code paths.

- [ ] **Step 1: Rewrite the six consumer requires**

Each is a one-line change. The destructured names do not change — only the module specifier.

`src/shared/aggregator.js:1`:
```js
const { costForEvent } = require('@tokenmonitor/core');
```

`src/shared/exportReport.js:5`:
```js
const { costForEvent } = require('@tokenmonitor/core');
```

`src/shared/historyAggregator.js:5`:
```js
const { costForEvent, pricingTierForModel } = require('@tokenmonitor/core');
```

`src/main/fleetSnapshotWriter.js:5`:
```js
const { evaluateOptimizeRules } = require('@tokenmonitor/core');
```

`src/main/ipcHandlers.js:9-11` — three lines collapse to one:
```js
const {
  evaluateOptimizeRules, evaluateOptimizeRulesWithRecurrence, summarizeOptimize,
  gradeBreakdown, appliedSummary,
  guidanceFor, isGuidanceApplied,
} = require('@tokenmonitor/core');
```

`src/main/optimizeActionHandlers.js:6`:
```js
const { guidanceFor, upsertGuidance } = require('@tokenmonitor/core');
```

- [ ] **Step 2: Confirm no consumer references the old paths**

```bash
grep -rn -E "require\(['\"]\.{1,2}/.*(modelPricing|optimizeRules|optimizeGrade|optimizeActions)" src/ test/
```

Expected: **no output.** Any hit is a consumer you missed — fix it before deleting anything.

- [ ] **Step 3: Delete the duplicated modules and their duplicated suites**

```bash
rm src/shared/modelPricing.js src/shared/optimizeRules.js \
   src/shared/optimizeGrade.js src/shared/optimizeActions.js
rm test/modelPricing.test.js test/optimizeRules.test.js \
   test/optimizeGrade.test.js test/optimizeActions.test.js
```

- [ ] **Step 4: Run the full suite**

```bash
npm test
```

Expected: **32 test files pass** from `test/` (35 from Task 2, minus 4 deleted, plus
`coreContract.test.js`), then the `@tokenmonitor/core` workspace suite passes with 43 assertions.
Zero failures.

A failure in `aggregator`, `exportReport` or `historyAggregator` means the package's behaviour
differs from the deleted copy — that is a real finding, not a test to adjust. Report it with the
assertion text rather than editing the test.

- [ ] **Step 5: Verify the app launches and the optimize panel still populates**

The optimize panel is the surface that exercises the most package code, so it is the one to look at.

```powershell
cd "$env:USERPROFILE\Desktop\TokenMonitorV2"
$p = Start-Process -FilePath "node_modules\.bin\electron.cmd" -ArgumentList "." -PassThru
Start-Sleep -Seconds 15
if ($p.HasExited) { "EXITED code $($p.ExitCode)" } else { "RUNNING" }
Get-Process -Name electron -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle } | Select-Object MainWindowTitle
```

Expected: `RUNNING`, then `Claude Token Tracker`. In the running window, confirm the Optimize panel
renders a setup grade badge and finding cards rather than an empty panel or an error. This is the
surface that exercises the most package code — `evaluateOptimizeRules`, `gradeBreakdown`,
`appliedSummary` and `guidanceFor` all feed it — so an empty Optimize panel with a green test suite
means the wiring is wrong somewhere the tests do not reach.

Then:

```powershell
Stop-Process -Name electron -Force
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: consume @tokenmonitor/core, delete the duplicated modules

Deletes src/shared/{modelPricing,optimizeRules,optimizeGrade,optimizeActions}.js
and repoints all six consumers at the package.

This is the correctness win the package was extracted for. The two copies
had already diverged in ways both test suites were blind to, each only
exercising its own data shape: eventTimestampMs (a Date here, coerced
strings there) and findUncappedBashOutput (result.resultLength vs
e._rawResultLength). Both are resolved in the package.

The four matching test files are deleted rather than repointed, because
packages/core/test/ already owns those suites and the root npm test runs
them via the workspace. Two copies of the same tests is the drift problem
this change exists to end."
```

---

## Definition of done

- `npm test` green: 32 `test/*.test.js` suites plus the `@tokenmonitor/core` workspace suite.
- `npm start` launches a window titled `Claude Token Tracker` with all ten panels rendering.
- `grep -rn "electron-updater\|update-token" src/ scripts/ package.json` returns nothing.
- `grep -rn "require('\./modelPricing')" src/` returns nothing.
- `node_modules/@tokenmonitor/core` is a symlink to `packages/core`, not a registry download.
- Four commits, one per task, each independently revertable.

## What this plan deliberately does not do

- **Does not touch the renderer.** No CSS, no markup, no inline styles. That is Phase 3 onward.
- **Does not rotate the deployed update token.** Open item for Matt, design spec section 5.
- **Does not archive or freeze the v1 repo.** Do that once this plan is verified, not before — v1
  stays the working app until the transplant is proven.
- **Does not add `buildInfo.json` or the version bump automation.** Convergence plan section 9,
  separate work.
