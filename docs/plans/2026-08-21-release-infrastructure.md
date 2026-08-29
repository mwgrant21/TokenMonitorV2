# Release Infrastructure Implementation Plan

**Goal:** Make it possible to cut a build of v2 and hand it to a department seat. Today nothing can
be released: there is no `buildInfo.json`, no version bump automation, `npm run dist` hard-fails on
missing signing material, and the `latest.json` version check that shipped on 2026-08-13 reads a
file that nothing writes.

**Scope:** implements steps 2, 3 (remainder), 4 and 5 of the sequencing in
`docs/design/aether-convergence-plan.md`, plus the producer for that document's one optional idea
whose consumer is already live. Step 1 (remove the auto-updater, publish config and bundled token)
is done and guarded by `test/noAutoUpdate.test.js`. Step 6 (delete the version line from
`CLAUDE.md`) is already clean - verified, no semver literal there.

**Architecture:** one generated file becomes the single source of truth. `scripts/dist.js` writes
`buildInfo.json`; the main process reads that instead of `app.getVersion()`; every version surface
- footer chip, Settings mirror, fleet snapshot, `latest.json` comparison - consumes it. The
convergence plan puts this first because steps 3, 4 and 5 all depend on it, and building them on
`app.getVersion()` is what it calls the call that has been lying to Aether.

## Decisions needed before Task 5, not for the implementer to make alone

1. **Code signing.** `npm run dist` requires `codesign/pfx-password.txt` and
   `codesign/tokentracker-codesign.pfx`; both `codesign/` and `secrets/` are gitignored, so neither
   exists on a fresh clone. `scripts/generate-codesign-cert.ps1` can make a matched pair, but a NEW
   self-signed cert is a different publisher identity from any build already installed. Either
   transport the existing `.pfx` or accept the identity change deliberately.
2. **Where `latest.json` is written.** The reader looks in the fleet share
   (`src/main/latestVersionReader.js`). Cutting a build has to drop the file there, and that path
   is per-deployment.
3. **Channel value.** `buildInfo.json` carries `channel`; the alpha version implies a channel, but
   nothing consumes it yet. Decide whether it drives behaviour or is metadata only.

## Global Constraints

- **No semver literal outside `package.json` and the generated `buildInfo.json`.** Task 2 adds a
  test that fails if one appears. That is what catches the version drift the convergence plan
  describes.
- **Never reintroduce `electron-updater` or any outbound version check.** `noAutoUpdate.test.js`
  fails if it returns. The design is offline by construction: a generated file, and one more file
  on a share that already exists.
- **Failing test first**, per this repo's existing plans - write it, run it, confirm it fails for
  the right reason, then implement.
- **`buildInfo.json` is generated, never committed.** Added to `.gitignore` in Task 1; a committed
  copy is a semver literal in the tree by another name.
- **ASCII only.**

---

### Task 1: `buildInfo.json` - generate it, and stop reading `app.getVersion()`

Convergence plan step 2. Everything downstream consumes this.

- [x] **Step 1: Write the failing test** - `test/buildInfo.test.js`: the generator produces
      version, commit, builtAt and channel; version matches `package.json`; commit is a short sha;
      builtAt parses as a date. Pure logic, no Electron.
- [x] **Step 2: Run it and confirm it fails** for the right reason - module absent, not a typo.
- [x] **Step 3: Add `src/shared/buildInfo.js`** - a pure builder plus a reader returning a
      documented `unknown` shape when the file is absent. The `unknown` case matters: a dev run has
      no generated file and must not render a plausible-but-wrong version. `latestVersionReader.js`
      already sets this precedent - a missing file renders `unknown`, never up-to-date.
- [x] **Step 4: Have `scripts/dist.js` write it** before invoking electron-builder, and add it to
      the files list in `electron-builder.yml` so it ships.
- [x] **Step 5: Replace `app.getVersion()`** at `src/main/main.js:221`, `:228` and `:231` - the
      `app:version` handler, the versionStatus seed, and the 60s recompute. Those three are the
      whole surface today.
- [x] **Step 6: Add `buildInfo.json` to `.gitignore`.**
- [x] **Step 7: Run the test, then the full suite.**
- [x] **Step 8: Verify live** - launch and confirm the footer chip shows the generated version
      rather than `unknown`; then delete the file, relaunch, and confirm it degrades to `unknown`
      rather than to a wrong number.
- [x] **Step 9: Commit.**

---

### Task 2: Automate the bump, and forbid stray version literals

Convergence plan step 5.

- [x] **Step 1: Write the failing test** - `test/noHardcodedVersion.test.js`: no semver literal in
      `src/`, `docs/`, the README or `CLAUDE.md`. Expect real hits and triage each; some will be
      legitimate prose about past versions and need an explicit allowlist with a written reason, so
      that being exempt is a decision someone made rather than a pattern that happened not to match.
- [x] **Step 2: Run it and record what it finds** before changing anything.
- [x] **Step 3: Add `standard-version`.** SUBSTITUTED: `commit-and-tag-version`, its
      maintained fork -- `standard-version` was sunset upstream, last published 2023-04-01.
      Same CLI, same config. The repo already uses conventional commit prefixes
      consistently, so the input exists.
- [x] **Step 4: Make `npm run dist` bump, tag, then build** - no hand-edited number anywhere.
- [x] **Step 5: Fix or allowlist every hit from Step 2.**
- [x] **Step 6: Run the full suite.**
- [x] **Step 7: Verify** by running the bump on a scratch branch, reading the changelog and tag as
      if handing them to someone, then resetting the branch. Done, and it earned its keep: the
      first changelog linked every hex colour and CSS selector in a commit body to a nonexistent
      GitHub issue. Fixed in `.versionrc.js` before the step was called done.
- [x] **Step 8: Commit.**

---

### Task 3: Finish the version readout - COPY VERSION INFO

Convergence plan step 3's remainder. The footer chip and Settings mirror shipped 2026-08-13; the
copy button did not.

- [x] **Step 1: Write the failing test** - a pure `versionInfoLine()` producing one clipboard line,
      asserting the product name is IN the string. The convergence plan is explicit about why: the
      failure mode is a user reading back the Claude Code version by mistake, so the pasted line
      has to say which product it is.
- [x] **Step 2: Run it and confirm it fails.**
- [x] **Step 3: Implement the helper in `src/shared/`** - pure, no Electron.
- [x] **Step 4: Add the button** to the footer version popover and the Settings block, using the
      existing clipboard bridge.
- [x] **Step 5: Run the full suite.**
- [x] **Step 6: Verify live** - click it, paste it, and read it as if someone had sent it to you.
- [x] **Step 7: Commit.**

---

### Task 4: Fleet version column

Convergence plan step 4. Rides the file share that already exists; no server, no network call.

- [x] **Step 1: Write the failing tests** - appVersion present in the snapshot written by
      `fleetSnapshotWriter.js`, and a pure `versionSpread(seats)` in `fleetAggregator.js` returning
      the distribution plus a behind-count.
- [x] **Step 2: Run them and confirm both fail.**
- [x] **Step 3: Add appVersion to `writeFleetSnapshot()`** from buildInfo, not `app.getVersion()`.
- [x] **Step 4: Add `versionSpread`** and surface a version column plus an N-seats-behind chip in
      the Team view.
- [x] **Step 5: Handle the compatibility case** - snapshots from older seats carry no appVersion
      and must render as unknown, not as a version.
- [x] **Step 6: Run the full suite.**
- [x] **Step 7: Verify live against a temp fleet folder.** NOTE: `fleet:connect` persists to the
      real `~/.claude-token-tracker/ui.json` - back it up first and restore after, or the app is
      left pointing at a folder that no longer exists.
- [x] **Step 8: Commit.**

---

### Task 5: Cut a build

The point of the plan. Blocked on the signing decision above.

- [ ] **Step 1: Resolve signing** - transport the existing `.pfx`, or generate a new pair knowing
      it changes the publisher identity.
- [ ] **Step 2: Write `latest.json` as part of cutting a build** - the producer for the reader that
      has been live since 2026-08-13. One file into the fleet share.
- [ ] **Step 3: Run `npm run dist` end to end** and install the result on this machine.
- [ ] **Step 4: Re-grant the AppContainer ACE** on the unpacked and installed directories.
      `npm run dist` drops it, and without it Electron dies with exit code -1073741515.
- [ ] **Step 5: Verify the installed build** reports the generated version, and that a seat pointed
      at a share carrying a higher `latest.json` shows the UPDATE AVAILABLE chip.
- [ ] **Step 6: Write `docs/RELEASE.md`** - the runbook, including the ACE re-grant and the
      `latest.json` drop. Both are easy to forget and silent when missed.
- [ ] **Step 7: Commit.**

---

## What this plan deliberately does not do

- **No plugin/marketplace bundle for department onboarding.** Named in the README's Not-here-yet
  section; this plan produces an installable build, it does not distribute it.
- **No wiring of Aether OS to `packages/core`.** Also outstanding, also unrelated to cutting a build.
- **No update server and no outbound check of any kind.** Deliberate, per the convergence plan and
  the decision that removed `electron-updater` along with the credential it bundled into every
  install.

