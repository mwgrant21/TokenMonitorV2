# Follow-ups

Known issues and owed disclosures, carried out of review rather than left in a
scratch ledger. Each entry says what it is, what evidence established it, and what
closing it looks like.

Opened 2026-08-05 from the phases 0-2 whole-branch review
([plan](plans/2026-08-05-app-move-phases-0-2.md)).

---

## 1. `findUncappedBashOutput` can never fire — latent bug

**Status:** open. Predates the v2 move; present in v1 identically.

`packages/core/src/optimizeRules.ts:128-129` evaluates
`result.resultLength ?? legacyEventLength ?? 0`. Neither field is ever set:

- `src/shared/transcriptParser.js:53-55` is the sole producer of `toolResults` and
  emits `.map((item) => ({ toolUseId: item.tool_use_id }))` — no `resultLength`.
- `grep -rn 'resultLength\|_rawResultLength' src/ test/` returns zero hits. The only
  repo-wide occurrences are the consumer above and the optional field on
  `types.ts:15`.

So the expression is `0` on every iteration and `0 > BASH_OUTPUT_SIZE_THRESHOLD` is
always false. `transcriptParser.js` is byte-identical to v1, so the rule was equally
dead there.

**This is a latent bug, not dead code.** The rule body is correct; its input is
missing. That distinction matters: a rule that silently under-reports is worse than
one that is absent, because the Optimize panel currently reads as "2 of 3 clean" when
it is really "2 of 3 measured."

**Fix:** carry the result size onto each tool result in `transcriptParser.js`
(`item.content.length` or equivalent), then confirm the rule fires against a
transcript with a large bash output.

## 2. `findCostOfThrash` changes the `$/wk` total versus v1 — disclosure owed

**Status:** open until the first user-facing build ships.

`packages/core` carries a fourth optimize rule, `findCostOfThrash`
(`packages/core/src/optimizeRules.ts:199-204`), that the app's deleted copy never had.
Its `estSavingsPerWeek` feeds `summarizeOptimize`'s total, so **the headline `$/wk`
figure can differ from v1 for identical input.**

Not a regression, and not a merge blocker at `2.0.0-alpha.0` with no users: it is an
added rule, `packages/core/README.md` documents it, the renderer builds finding cards
generically, and thrash has no grade row so letter grades are unaffected.

**But `$/wk` is user-facing.** This must appear in the release notes of the phase that
first puts a build in someone's hands. Do not let it ship silently.

## 3. The divergence narrative overstates itself — doc correction

**Status:** open. Cosmetic, but actively misleading to the next reader.

Two places assert divergences that do not hold against the current code:

- **`eventTimestampMs`.** The rationale says TokenMonitor coerced string timestamps.
  It does not: `src/shared/transcriptParser.js:15` already converts `json.timestamp`
  to a `Date` at parse time, so the package's string-coercion branch is dead for this
  app. Stated in `README.md` and in commit `4270261`'s message.
- **`findUncappedBashOutput`.** `packages/core/src/optimizeRules.ts:121-127` comments
  that TokenMonitor uses `e._rawResultLength` and that the fallback should be removed
  "once TokenMonitor's transcriptParser emits resultLength" — implying the fallback is
  load-bearing. It is not; see item 1. `_rawResultLength` is set nowhere in either
  repo.

Both were written from the Aether side without checking the TokenMonitor side. Fix as
one doc-correction commit. Leave commit messages alone — history is immutable and the
code is right.

**Root cause worth remembering:** a test suite can be unanimously green and still
wrong, and so can a migration rationale. The extraction's headline claim — two copies
had silently diverged — is true, but at least one of its two named examples does not
survive contact with the code it describes.

## 4. Minor cleanups

- **`scripts/dist.js:5`** — `const secretsDir` has no readers after the auto-updater
  removal. Inert path string; sweep it with the next `scripts/` touch.
- **`test/noAutoUpdate.test.js`** — `SCAN_DIRS` covers only `src/` and `scripts/`. A
  future updater reference in `packages/core/src` or a new repo-root file would evade
  all three assertions. One-line hardening.
- **Root `package.json` test script ordering** — `node --test "test/*.test.js" && npm
  test --workspace @tokenmonitor/core` runs `coreContract.test.js` (which requires the
  built CJS) *before* the step that builds it. It works only because install-time
  `prepare` already built `dist/`. Delete `packages/core/dist` and `npm test` fails
  with an opaque `Cannot find module` instead of rebuilding. Swapping the two halves
  makes it self-healing.

## 5. Light mode inherits dark-tuned alarm colours — contrast risk

**Status:** open until light-mode alarm UI is rendered and visually verified.

`src/renderer/styles/tokens.css` defines alarm colours (--success, --warn, --danger)
once in `:root` with dark-mode-optimized pastel values (#3be0a0 green, #f5c66b yellow,
#ff6b7a red). The prototype file (docs/prototype/index.html) defined distinct
light-mode versions for each palette (e.g. cyan light: #0f7f55, #96660f, #b3283a).
These light-tuned values were excluded from tokens.css because alarms must be identical
across every palette per test/tokens.test.js test 3. This means light mode currently
inherits the dark-tuned set, which may have inadequate contrast against light
backgrounds.

**Evidence:** Prototype lines 118/132/146/160/174 contain palette-specific light-mode
alarm definitions; see docs/prototype/index.html. No alarm-styled UI is rendered yet
(Phase 1 only wires the token layer), so contrast cannot be verified currently.

**Fix:** When the first task renders alert/warning/danger-coloured UI in light mode,
verify contrast against WCAG AA for the actual background (token --bg-base varies per
palette). If contrast is insufficient, either (a) define palette-specific alarm colours
and modify test 3 to exclude them, or (b) create separate light-tuned alarm tokens
(--success-light, --warn-light, --danger-light) and wire them in light mode only.

**Owner:** Whichever task first wires alert/warning/danger styling into visible UI
(likely Phase 3 or later, when panel content renders).

---

## Not a code issue: rotate the deployed update token

**Owner: Matt. Not actionable in this repo.**

The auto-updater removal (commit `ccbff25`) stops any future build from bundling
`secrets/update-token.txt`. It does **not** rotate the GitHub token already present, in
plaintext, in the install directory of every machine v1 was deployed to — readable by
anyone who can browse `%LOCALAPPDATA%\Programs\Claude Token Tracker`.

Removing the feature retires the exposure going forward. Closing it retroactively
requires revoking that PAT.
