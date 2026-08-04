# packages/core Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the duplicated copies of `modelPricing`, `optimizeRules`, `optimizeGrade` and `optimizeActions` in TokenMonitor and Aether OS, replacing both with a single `@tokenmonitor/core` package — and resolve the two behavioural divergences the duplication was already hiding.

**Architecture:** A pure-logic TypeScript package at `TokenMonitor/packages/core`, built to dual ESM + CJS output. Aether OS imports the ESM entry with types; TokenMonitor `require`s the CJS entry. No bundler: `build.mjs` runs `tsc` then mechanically rewrites the ESM output to CJS, which is only safe because the package has zero dependencies and no dynamic imports.

**Tech Stack:** TypeScript 5.6 (strict), `tsc`, Node's built-in `node --test` for the package's own suite, existing `vitest` in Aether and `node --test` in TokenMonitor for the consumer suites.

## Global Constraints

- **The package is already written and verified.** `packages/core/` has been committed with source, build script, README and tests. **TokenMonitor's four original test files pass against it unmodified** (43 assertions green, including an added ESM-entry suite). Do not rewrite the package from scratch — this plan is about *wiring the two apps to it and deleting the old copies*.
- **Zero API cost applies.** Nothing in this package may ever make a model call. It is pure logic — no `fs`, no Electron, no network.
- Do not "simplify" `eventTimestampMs` in `src/types.ts` or the `resultLength` fallback in `src/optimizeRules.ts`. Both carry a comment explaining a real bug they fix. Removing either reintroduces it.
- TokenMonitor has **no bundler and no build step for `src/`**. This plan introduces the first one, and it applies only to `packages/core` — do not add a build step for `src/main`, `src/renderer` or `src/shared`.
- `npmRebuild: false` and the node-pty prebuild arrangement in `electron-builder.yml` are load-bearing (see CLAUDE.md). Do not change them. `packages/core` is pure JS and needs no rebuild.
- Node v25 breaks the bare-directory `node --test` form — always invoke via the `npm test` script.
- Run `npm test` in **both** repos before declaring any task done. A task is not complete on a green build alone.

---

### Task 1: Land the package and verify it standalone

**Files:**
- Already created: `packages/core/{package.json,tsconfig.json,build.mjs,README.md}`
- Already created: `packages/core/src/{index,types,modelPricing,optimizeRules,optimizeGrade,optimizeActions}.ts`
- Already created: `packages/core/test/{modelPricing,optimizeRules,optimizeGrade,optimizeActions}.test.cjs`, `packages/core/test/esm-entry.test.js`

**Interfaces:**
- Produces: `dist/cjs/*.cjs` (CommonJS, consumed by TokenMonitor) and `dist/esm/*.js` + `*.d.ts` (ESM + types, consumed by Aether). Tasks 2 and 4 depend on both existing.

- [ ] **Step 1: Install and build**

```
cd packages/core
npm install
npm run build
```

Expect `built 6 module(s) -> dist/esm (ESM) + dist/cjs (CJS)`.

- [ ] **Step 2: Run the package's own suite**

```
npm test
```

Expect **43 passing, 0 failing.** Four of those files are TokenMonitor's original tests with only the `require` path rewritten — that is the evidence the extraction is behaviour-preserving. If any fail, stop and diagnose before touching either app.

- [ ] **Step 3: Add `dist/` to `.gitignore`**

Build output is not committed. Confirm `packages/core/dist` is ignored and `packages/core/node_modules` is ignored.

---

### Task 2: Wire TokenMonitor to the package

**Files:**
- Modify: `package.json` (workspaces + dependency)
- Modify: `src/shared/optimizeRules.js`, `src/shared/optimizeGrade.js`, `src/shared/optimizeActions.js`, `src/shared/modelPricing.js` → deleted, and every importer updated
- Modify: `electron-builder.yml` if `files` globs exclude `packages/`

**Interfaces:**
- Consumes: `packages/core/dist/cjs/index.cjs`
- Every current `require('../shared/optimizeRules')`-style call site must resolve to the package instead. Find them with a repo-wide search before editing — `src/main/fleetSnapshotWriter.js`, `src/main/optimizeActionHandlers.js`, `src/main/ipcHandlers.js` and the renderer's `panels/optimize.js` are known consumers, but **verify the full list rather than trusting this one.**

- [ ] **Step 1: Add the workspace**

In root `package.json`:

```json
"workspaces": ["packages/*"],
"dependencies": { "@tokenmonitor/core": "1.0.0", ... }
```

Run `npm install` at the root and confirm `node_modules/@tokenmonitor/core` is a symlink into `packages/core`.

- [ ] **Step 2: Repoint every consumer**

Replace `require('../shared/optimizeRules')` etc. with `require('@tokenmonitor/core')`. The exported names are unchanged — `evaluateOptimizeRules`, `evaluateOptimizeRulesWithRecurrence`, `RULES_BY_ID`, `summarizeOptimize`, `gradeBreakdown`, `appliedSummary`, `BAD_THRESHOLD_PER_WEEK`, `costForEvent`, `pricingTierForModel`, `PRICING_PER_MILLION_TOKENS`, `upsertGuidance`, `isGuidanceApplied`, `guidanceFor`, `MANAGED_BEGIN`, `MANAGED_END`, `HEADING`, `GUIDANCE_BY_ID` — so this is a path change only.

**The renderer is the sharp edge.** `src/renderer/` uses classic `<script>` globals with no module system and cannot `require`. Check whether the renderer's `optimize.js` imports any of these four modules. If it does, do **not** try to make `require` work there — expose what it needs over the existing preload/IPC surface instead, the way the rest of the renderer already gets main-process data. If it turns out the renderer only consumes already-computed findings over IPC, note that in the commit message and move on.

- [ ] **Step 3: Delete the four old modules and their tests**

Delete `src/shared/{modelPricing,optimizeRules,optimizeGrade,optimizeActions}.js` and `test/{modelPricing,optimizeRules,optimizeGrade,optimizeActions}.test.js`. Their coverage now lives in `packages/core/test/`.

- [ ] **Step 4: Run the full suite**

```
npm test
```

Every remaining suite must pass. `fleetSnapshotWriter.test.js` and `optimizeState.test.js` exercise the seam and are the most likely to surface a missed import.

- [ ] **Step 5: Verify packaging**

```
npm run dist
```

Confirm the installer builds and that `packages/core/dist` is included in the asar. Then **re-grant the AppContainer ACL** on `dist\win-unpacked` per CLAUDE.md — `npm run dist` invalidates it and the app will crash with `-1073741515` otherwise. Launch the built app and confirm the Optimize panel still renders findings.

---

### Task 3: Confirm TokenMonitor gained the `cost-of-thrash` rule

**Interfaces:**
- Consumes: `RULES_BY_ID` from the package, which now has four entries where TokenMonitor's copy had three.

- [ ] **Step 1: Verify the rule fires**

`cost-of-thrash` is new to TokenMonitor. Run the app against a real session with repeated reads of one file and confirm a fourth finding card appears.

- [ ] **Step 2: Confirm the grade breakdown still renders four rows**

`gradeBreakdown` deliberately has **three scored factors plus context hygiene** — `cost-of-thrash` contributes to the `$/wk` total via `summarizeOptimize` but has no grade row. This matches both apps' prior behaviour. If a fifth row appears, something regressed.

- [ ] **Step 3: Confirm the Apply-fix action works for the new rule**

`GUIDANCE_BY_ID` in the package includes a `cost-of-thrash` entry that neither app had. Apply it and confirm the managed block in `CLAUDE.md` gains the line and everything outside it is preserved byte for byte.

---

### Task 4: Wire Aether OS to the package

**Files:**
- Modify: `aether-os/package.json`
- Delete: `aether-os/src/shared/{modelPricing,optimizeRules,optimizeGrade,optimizeActions}.ts` and their `.test.ts` siblings
- Modify: every importer of those modules

**Interfaces:**
- Consumes: `packages/core/dist/esm/index.js` + `index.d.ts`

- [ ] **Step 1: Add the dependency**

Aether lives in a sibling directory, so a file dependency is the pragmatic wiring:

```json
"dependencies": { "@tokenmonitor/core": "file:../TokenMonitor/packages/core" }
```

**Flag this honestly:** a cross-repo `file:` dependency is fragile — it assumes both repos sit side by side under `C:\Users\Matt\projects\`, and it will break for anyone who clones only one. It is the right trade for a two-repo personal setup and the wrong one if this ever ships to other people. The alternatives are a real monorepo containing both, or publishing the package to a private registry. **Do not silently pick a different option — if the file dependency is unacceptable, stop and raise it.**

- [ ] **Step 2: Repoint imports and delete the old modules**

Replace `from './modelPricing'` / `'./optimizeRules'` / `'./optimizeGrade'` / `'./optimizeActions'` with `from '@tokenmonitor/core'`. Delete the four source files and their tests.

- [ ] **Step 3: Fix the `TranscriptEvent` coupling**

Aether's `optimizeRules.ts` imported `TranscriptEvent` from `electron/transcriptParser`. The package now owns that type. Anywhere that relied on the electron-side type being structurally identical, confirm it still typechecks — `tsc -b` will tell you. If `electron/transcriptParser.ts`'s own `TranscriptEvent` has fields the package's version lacks, **do not widen the package's type to match**; the package deliberately declares only what the rules consume.

- [ ] **Step 4: Run the suite and typecheck**

```
npm test        # vitest -- expect the count to drop by the four deleted suites
npm run build   # tsc -b && vite build -- must typecheck clean
```

- [ ] **Step 5: Confirm Aether gained the defensive timestamp handling**

Add a regression test asserting `evaluateOptimizeRulesWithRecurrence` works when `timestamp` is an ISO **string**, not just a `Date`. Aether's old copy would have thrown. This is the divergence that makes the whole extraction worth doing — prove it is fixed.

---

### Task 5: Close the loop

- [ ] **Step 1: Update both CLAUDE.md files**

TokenMonitor's architecture map still lists the four modules under `src/shared/`. Aether's does too. Both must now point at `@tokenmonitor/core`, and both should note the "put testable logic in the shared package" convention.

- [ ] **Step 2: Fix the version drift while you are in there**

TokenMonitor's `CLAUDE.md` line 21 says `Version 0.1.2`; `package.json` says `0.1.3`. Delete the version from `CLAUDE.md` rather than correcting it — a hand-maintained second copy is the bug, not the wrong number.

- [ ] **Step 3: Remove the `_rawResultLength` fallback (follow-up, optional)**

Once TokenMonitor's `transcriptParser` emits `resultLength` per tool result rather than one length per event, delete the fallback in `packages/core/src/optimizeRules.ts` and the comment above it. Until then it stays — it is what keeps TokenMonitor's existing data working.
