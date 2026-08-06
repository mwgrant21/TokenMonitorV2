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

Opened 2026-08-06 while executing reskin Task 3
([plan](plans/2026-08-05-reskin-phases-3-4.md)).

## 5. The compatibility alias layer is inert — the reskin is not reaching dashboard.css

**Status:** open. Closes in Task 4 under the resequenced order (5 -> 6 -> 4).

Task 1 added an alias block at `src/renderer/styles/tokens.css:258` mapping v1's ten
variables onto the Aether tokens (`--bg: var(--bg-base)`, and so on) so that "every
existing rule in dashboard.css resolves through these unchanged." It does not.

`src/renderer/dashboard/dashboard.css:2-4` still declares the same variables as
literals, at identical `:root` specificity, and `src/renderer/index.html` links
`dashboard.css` *after* `tokens.css`. Later wins. Measured in a real Chromium context
with `data-pal="steel"` active, not inferred from the cascade:

| token | value |
|---|---|
| `--bg-base` (steel dark, tokens.css) | `#0a0c0d` |
| `--bg` (alias, should follow it) | `#0b0e14` |
| resolved `var(--bg)` | `rgb(11, 14, 20)` |

So every rule referencing `--bg`, `--panel`, `--panel2`, `--bd`, `--tx`, `--dim`,
`--soft` or `--acc2` paints v1 Midnight in all nineteen palettes. The palette-specific
tokens (`--acc`, `--tx-primary`, `--bg-base`) do land, because their blocks are
`html[data-pal][data-mode]` and outrank `:root` — which is why the app looks *partly*
restyled and hides the problem.

**This is why "the app still looks like v1" is not only unstyled chrome.** Tasks 1 and 2
are real work that is currently invisible below the token layer.

**Fix:** delete dashboard.css's `:root` literal block along with its nine
`[data-palette]` blocks. Not safe before Task 6 — see item 6 for why.

## 6. Tokyo Night is still selectable, having been cut for failing WCAG

**Status:** open. Live accessibility issue, not cosmetic. Closes in Task 4.

Task 2 cut `tokyonight` on measured contrast failure (`tx-muted` 2.76:1, `tx-dim`
2.31:1) and `test/contrast.test.js` enforces its absence. From `tokens.css` only.

`src/renderer/dashboard/panels/settingsPanel.js:18` still lists it, and
`src/renderer/dashboard/dashboard.css:26` still defines it, so it remains a working,
user-selectable palette. The test binds the new layer while the old layer serves the
users.

**Root cause worth remembering, shared with item 5:** a new layer was added beside an
old one that was never removed, and the tests only bind the new layer. Green suite,
unchanged behaviour. Same class as item 1 — a correct rule whose input never arrives.
Adding a layer is not migrating to it; the migration is the deletion.

**Why neither can be fixed yet:** `data-palette` is the live switch
(`settingsPanel.js:42`, restored at `index.html:196`), while `data-pal`/`data-mode` are
static attributes on `<html>` that nothing ever writes. Deleting the legacy blocks
before Task 6 rebuilds the control would leave palette switching doing nothing at all.
Hence the resequence to 5 -> 6 -> 4 agreed 2026-08-06.

---

## Not a code issue: rotate the deployed update token

**Owner: Matt. Not actionable in this repo.**

The auto-updater removal (commit `ccbff25`) stops any future build from bundling
`secrets/update-token.txt`. It does **not** rotate the GitHub token already present, in
plaintext, in the install directory of every machine v1 was deployed to — readable by
anyone who can browse `%LOCALAPPDATA%\Programs\Claude Token Tracker`.

Removing the feature retires the exposure going forward. Closing it retroactively
requires revoking that PAT.
