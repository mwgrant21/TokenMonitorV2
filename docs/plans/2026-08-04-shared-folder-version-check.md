# Shared-Folder Version Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a seat notice it is running an out-of-date build, using only a `latest.json` file dropped into the shared fleet folder — no update server, no network request, no bundled credential. Rollout stays manual; this only removes the need to chase people.

**Architecture:** `latest.json` sits beside the per-seat snapshots in the existing share (`\\shared\claude-usage\`). Main reads it on the same cadence as the fleet scan, compares it to the app's own version with pure logic, and pushes a status to the renderer, which renders a chip next to the version readout in the footer. Three states: `current`, `behind`, `unknown`.

**Tech Stack:** Plain CommonJS in TokenMonitor's existing style — pure logic in `src/shared/`, fs access in `src/main/`, `node --test`.

## Global Constraints

- **No network. Ever.** This feature reads one local file off an SMB share the app already reads. If any step reaches for `https`, `fetch`, `electron-updater` or a release feed, it has gone wrong — stop.
- **`unknown` must never render as `current`.** A missing, unreachable or malformed `latest.json` means *we do not know*. Silently claiming "up to date" is precisely the failure this feature exists to prevent, and is the same shape as the silent-updater problem that motivated deleting `electron-updater`.
- The fleet folder is **optional** — many seats will never configure one. With no folder set, the feature is inert and the footer shows the version with no chip. It must never nag, error, or block startup.
- `uiConfig.js#sanitize` is a **whitelist**: any new `ui.json` key must be added to *both* `UI_DEFAULTS` and `sanitize` or it is silently dropped. This plan does not add one, but the temptation will arise — do not.
- **The pure logic is already written and verified.** `src/shared/versionCheck.js`, `src/main/latestVersionReader.js` and their two test files are committed, with 10 assertions green. This plan is about wiring, IPC and UI.
- Run `npm test` before declaring any task done.

---

### Task 1: Verify the committed logic

**Files:**
- Already created: `src/shared/versionCheck.js`, `src/main/latestVersionReader.js`
- Already created: `test/versionCheck.test.js`, `test/latestVersionReader.test.js`

**Interfaces:**
- Produces: `deriveVersionStatus(current, latest) -> { state: 'current'|'behind'|'unknown', current, latest, behindBy: 'major'|'minor'|'patch'|null }` and `readLatestVersion(folderPath) -> Promise<string|null>`. Tasks 2 and 3 consume both.

- [ ] **Step 1: Run the two new suites**

```
npm test
```

Expect the two new files to contribute **10 passing assertions**, covering: numeric-not-lexical ordering (`2.1.7 < 2.1.10`), `v`-prefixes, build tags (`2.1.7+a3f9c21`), short forms (`2.1` == `2.1.0`), a local build *ahead* of the share reading as `current` rather than `behind`, and every read failure mode collapsing to `unknown`.

---

### Task 2: Read `latest.json` alongside the fleet scan

**Files:**
- Modify: `src/main/main.js` (the existing 60s history rescan / fleet cadence)
- Modify: `src/main/ipcHandlers.js`

**Interfaces:**
- Consumes: `ui.fleetFolder` (already persisted), `app.getVersion()` **or** the generated `buildInfo.json` if the versioning plan has landed first — prefer `buildInfo` when present.
- Produces: an IPC channel (suggested `version:getStatus`) returning `deriveVersionStatus(...)`'s object.

- [ ] **Step 1: Add the read to the existing periodic scan**

Do **not** add a new timer. `main.js` already runs a 60s history rescan and the fleet snapshot read; hang this off the same tick. Reading one small file per minute off a share is free; a second independent interval is avoidable complexity.

- [ ] **Step 2: Expose it over IPC and preload**

Add the handler in `ipcHandlers.js` and the corresponding `contextBridge` entry in `preload/preload.js`. Remember `window.tokenTracker` is **frozen** — the API must be declared in preload, not patched on later.

- [ ] **Step 3: Cache the last known status**

Hold the last computed status in main so the renderer's first paint has something to show without waiting a full tick. Initial value is `unknown`.

- [ ] **Step 4: Write a test for the wiring**

Follow `test/fleetSnapshotReader.test.js`'s pattern — a temp directory standing in for the share.

---

### Task 3: Render the chip

**Files:**
- Modify: `src/renderer/index.html` (footer)
- Modify: `src/renderer/dashboard/dashboard.css`
- Modify: `src/renderer/dashboard/panels/settingsPanel.js` (mirror the status in the About block)

**Interfaces:**
- Consumes: the `version:getStatus` IPC result.

- [ ] **Step 1: Render the three states**

Next to the version readout in the footer:

| State | Chip |
|---|---|
| `current` | no chip at all — silence is the reward for being up to date |
| `behind` | `UPDATE AVAILABLE · v2.2.0` in `--warn`, and `--danger` when `behindBy === 'major'` |
| `unknown` | no chip — do **not** show an error. The share being unreachable is not the user's problem and not worth a badge. |

Two of the three states render nothing. That is deliberate: the only time this feature should be visible is the one time it has something useful to say.

- [ ] **Step 2: Make the chip explain the manual rollout**

Clicking it opens the same popover as the version readout, with one added line: *"A newer build is available. Contact IT to have it installed."* No download button, no self-service install — the rollout is manual by design and the chip must not imply otherwise.

- [ ] **Step 3: Mirror it in Settings**

The Settings popover's version block should show the same status, so someone who opens Settings to check their version sees it there too.

---

### Task 4: Document the publishing step

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write down the one-line release ritual**

After cutting a build and pushing it to devices, drop into `\\shared\claude-usage\latest.json`:

```json
{ "version": "2.2.0", "notes": "tach instruments, palette rework", "published": "2026-08-04" }
```

Only `version` is read today; `notes` and `published` are for humans reading the file and are safe to add.

- [ ] **Step 2: Note the ordering trap**

Publishing `latest.json` **before** the build actually reaches machines makes every seat show `UPDATE AVAILABLE` for a build nobody can get, which trains people to ignore the chip. Update the file *after* the rollout, not before.
