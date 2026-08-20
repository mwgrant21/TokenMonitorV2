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

## 6. Legacy `data-palette` engine still live in `dashboard.css` alongside the new token layer

**Status:** closed. Resolved by Task 6 (Palette and mode controls in Settings) — see the
"Resolution" section at the end of this item for what was verified and how.

`src/renderer/dashboard/dashboard.css` lines 2-41 define a second, complete palette-colour
system (`:root` default + 9 `[data-palette="..."]` blocks, ~85 hex literals) that predates
Tasks 1-3's `tokens.css` layer. It is not dead code: `settingsPanel.js:42` sets
`document.documentElement.dataset.palette = slug` and is the only currently-wired theme
picker the user can actually operate. The new `data-pal`/`data-mode`/`data-lang` attributes
(consumed by `tokens.css`) are only ever set once, statically, in `index.html` — nothing
drives them dynamically yet. Because `dashboard.css` loads after `tokens.css` and both
declare `:root { --bg: ...; }` etc., the legacy block currently wins the cascade for any
rule still written in terms of the old variable names (`--bg`, `--panel`, `--tx`, ...).

**Evidence:** Task 4 implementer's guard test (`test/paletteEscapes.test.js`, "no hardcoded
hex colours outside tokens.css") flags all ~85 literals when run unscoped against
`dashboard.css`; full listing in task-4-report.md
(.superpowers/sdd/2026-08-05-reskin-phases-3-4/).

**Fix:** Delete `dashboard.css`'s `:root`/`[data-palette]` block, confirm every rule that
read `--bg`/`--panel`/`--panel2`/`--bd`/`--tx`/`--dim`/`--acc`/`--acc2`/`--warn`/`--soft`
still resolves through `tokens.css`'s compatibility aliases, and rewire `settingsPanel.js`
(and any downstream consumer, e.g. `dashboard.js`'s `KNOWN_PALETTES`) to set
`data-pal`/`data-mode` instead of `data-palette`.

**Additional downstream consumer found in Task 4:** `src/renderer/terminal/terminal.js`'s
`applyTerminalTheme()` (called once at mount, and again by `settingsPanel.js:45` on every
`data-palette` change) reads `--bg`/`--tx`/`--acc` — the legacy names — and is called
synchronously right after the terminal mounts. Task 4 fixed the xterm constructor's
*initial* theme to read `--bg-term`/`--tx-primary` (the new token names), but confirmed live
via CDP that `applyTerminalTheme()`'s subsequent call immediately overwrites it back to the
legacy-engine value in both a dark and a light `data-pal`/`data-mode` state (terminal stayed
at `#0b0e14`/`#e7ebf3` in both). So today the terminal's *rendered* colour still tracks only
the legacy `data-palette` system, not `data-pal`/`data-mode`, even though the escape (the
hardcoded hex literal) is closed. When this item's migration rewires the legacy engine,
`applyTerminalTheme()` must also switch to `--bg-term`/`--tx-primary` or the terminal will
silently stop following the palette picker Task 6 builds.

**Owner:** Task 6 ("Palette and mode controls in Settings") — its own scope already says
"Palette grid rebuilt for 19; light/dark toggle added," which is the natural point to retire
the old engine and picker together rather than leaving two unsynced systems live.

**Additional downstream consumer found in Task 5:** `src/main/ipcHandlers.js`'s `theme:set`
handler calls `saveThemeConfig(path, { theme })` with no `mode` key. Before Task 5,
`saveThemeConfig` silently discarded every key except `theme` (Trap 1), so this was
harmless. Task 5 fixed `saveThemeConfig` to actually persist `mode` — which means every
palette change made through the current settings UI now resets the saved `mode` back to
the default (`'dark'`), since the handler never passes the current mode through. Not
covered by any existing test (no test exercises the IPC handler end-to-end). Task 6 must
update `theme:set` to read and forward the current `mode` alongside `theme` when it wires
the light/dark toggle, or a working toggle will appear to revert to dark every time the
user also changes palette.

**Resolution (Task 6):** all three parts closed together, because they are one migration.

- `dashboard.css`'s legacy `:root` default and nine `[data-palette="..."]` blocks are deleted;
  a comment in their place records why. `test/paletteEscapes.test.js` dropped its
  `LEGACY_PALETTE_BLOCK` exclusion (now dead code) and scans `dashboard.css` whole, plus a new
  test asserts no `[data-palette]` rule ever comes back.
- `settingsPanel.js`'s `selectPalette()` now writes `data-pal`, `data-mode` and `data-lang`
  (lang derived from the palette, mirroring `deriveLang()`), never `data-palette`. A new
  `selectMode()` drives the light/dark segmented control. Each preserves the axis the user did
  not touch. `index.html`'s boot script applies the stored `theme`/`mode`/`lang` to the same
  three attributes instead of `data-palette`.
- `terminal.js`'s `applyTerminalTheme()` reads `--bg-term`/`--tx-primary`/`--acc`, matching the
  constructor's initial-theme read from Task 4.
- `ipcHandlers.js`'s `theme:set` validates and forwards `mode` alongside `theme`, falling back
  to the persisted value for whichever key the payload omits.

**Verified live** (Electron + CDP, not by reading code): the ten old names resolve with zero
unresolved entries under midnight/dark, violet/dark, violet/light, nord/light, steel/light,
solarized/light, emerald/light and catppuccin/light — probed by assigning `var(--name)` to a
detached-style probe and checking the declaration did not fall back to its initial value. The
renderer uses exactly eleven distinct custom properties across `dashboard/`, `fleet/`,
`terminal/` and `index.html` (the ten aliases plus `--danger`, a native tokens.css token), so
name-level resolution covers all 309 `var()` call sites. Body background, panel gradients,
panel borders, label text, accent fills and the xterm theme were each confirmed to repaint per
palette and per mode. Violet + light survived a full process kill and relaunch with the light
appearance intact, not just the persisted value.

**Known limitation, by design:** the nine legacy palettes are declared in `tokens.css` without
a `[data-mode]` qualifier, so they render identically in both modes. The mode control is
therefore disabled (with a `title` explaining why) while a legacy palette is active; the stored
mode is preserved untouched and re-applies as soon as an Aether palette is selected.

---

## 7. Flat-language `box-shadow:none` override targets classes that don't exist in this app

**Status:** open. Cosmetic; was inert before Task 7 and remains inert after, not a regression.

`src/renderer/styles/tokens.css:179-181` reads:
```css
html[data-lang="flat"] .panel,
html[data-lang="flat"] .tile,
html[data-lang="flat"] .reactor-panel{ box-shadow:none !important; }
```
This was copied from the prototype, which uses `.panel`/`.tile`/`.reactor-panel` as its actual
panel class names. This app never has and does not now use those class names anywhere — its
panels are `.hero-tile`, `.budget-panel`, `.agents-panel`, `.task-panel`, `.optimize-panel`,
`.treemap-panel`, `.insights-card`, `.optimize-card` (confirmed by a full-tree grep: the only hit
for `.panel`/`.tile`/`.reactor-panel` in `src/renderer` is this rule itself). Before Task 7, this
was harmless because no panel had a `box-shadow` to suppress. Task 7's panel formula
(`background: var(--panel-grad); border: var(--panel-bd); box-shadow: 0 1px 0 var(--acc-wash)
inset, 0 10px 30px rgba(0,0,0,.28)`) now gives all 8 of those panels a real shadow, and this
override still can't reach any of them — so legacy/flat palettes render a drop shadow the
prototype's own design intended to suppress on flat surfaces. Subtle in practice (dark shadow
against typically-dark legacy palettes) but a real, now-live visual gap.

**Fix:** retarget the selector at this app's actual panel classes. Each selector must be
individually prefixed with `html[data-lang="flat"]` — a bare comma-separated list where only the
first selector carries the prefix would make the rest match globally in every language/palette,
stripping Task 7's panel shadow everywhere instead of only on flat surfaces:
```css
html[data-lang="flat"] .hero-tile,
html[data-lang="flat"] .budget-panel,
html[data-lang="flat"] .agents-panel,
html[data-lang="flat"] .task-panel,
html[data-lang="flat"] .optimize-panel,
html[data-lang="flat"] .treemap-panel,
html[data-lang="flat"] .insights-card,
html[data-lang="flat"] .optimize-card{ box-shadow:none !important; }
```
(equivalently, `html[data-lang="flat"] :is(.hero-tile, .budget-panel, .agents-panel, .task-panel,
.optimize-panel, .treemap-panel, .insights-card, .optimize-card)`)

**Owner:** unassigned — not in scope for any of the 8 tasks in `docs/plans/2026-08-05-reskin-
phases-3-4.md`. Small, one-line fix; pick up opportunistically or as its own quick task.

---

## Not a code issue: rotate the deployed update token

**Owner: Matt. Not actionable in this repo.**

The auto-updater removal (commit `ccbff25`) stops any future build from bundling
`secrets/update-token.txt`. It does **not** rotate the GitHub token already present, in
plaintext, in the install directory of every machine v1 was deployed to — readable by
anyone who can browse `%LOCALAPPDATA%\Programs\Claude Token Tracker`.

Removing the feature retires the exposure going forward. Closing it retroactively
requires revoking that PAT.
