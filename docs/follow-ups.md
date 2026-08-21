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

**Status:** closed. Resolved by the final-review fix wave — see the "Resolution" section at
the end of this item for the measured before/after contrast and the one residual it leaves.

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

**What made it reachable:** Task 6 shipped the light/dark toggle and Task 7 added the
alarm-coloured `.footer-alarm` element, so the trigger condition above fired mid-branch. The
whole-branch review then measured `.alert-row.critical` at **1.41:1** in steel/light — the
app's highest-priority alert UI was unreadable.

**Resolution (final-review fix wave):** took option (a). All five
`html[data-pal="X"][data-mode="light"]` blocks in `tokens.css` now declare
`--success:#0f7f55; --warn:#96660f; --danger:#b3283a;`, copied verbatim from
`docs/prototype/index.html` lines 118/132/146/160/174 (re-checked against the prototype, not
transcribed from memory). Dark mode and the nine legacy `[data-lang="flat"]` palettes are
untouched and still inherit the `:root` set.

`test/tokens.test.js` test 3 was rewritten rather than deleted: it now asserts the five Aether
palettes agree with each other *within* each mode, that no dark block redeclares an alarm token
at all (even redundantly), and that the light triple matches the prototype and differs from the
dark one. Its "an alert must mean the same thing on every desk" invariant is preserved, scoped
per mode. Mutation-tested three ways (diverge one light palette; add a redundant dark override;
revert the light triple to the pastels) — all three fail the test.

**Verified live** (real Electron renderer + real IPC backend against scratch config paths, not
by reading code): the driver probes inject the real alarm classes into the live document and
read `getComputedStyle`, then compute WCAG ratios against the composited backdrop. Run once
with the pre-fix state restored and once after. steel/light:

| element | before | after | floor |
|---|---|---|---|
| `.alert-row.critical` text on `--warn` fill | 1.41 | 4.41 | 4.5 |
| `.optimize-grade` text on `--warn` fill | 1.41 | 4.41 | 4.5 |
| `.forecast-status.over` `--warn` text on panel | 1.41 | 4.48–4.95 | 4.5 |
| `.footer-alarm.warn` text on chrome | 1.54 | 4.84 | 4.5 |
| `.footer-alarm.crit` text on chrome | 2.66 | 6.20 | 4.5 |
| `.budget-fill.warn` vs `.budget-track` | 1.56 | 4.87 | 3 |
| `.mini-alert` `--warn` left bar vs panel2 | 1.56 | 4.87 | 3 |
| `.mini-alert.critical` `--danger` left bar | 2.68 | 6.24 | 3 |
| `.cli-toast-icon` `--warn` on panel2 | 1.56 | 4.87 | 3 |
| `.alert-row.warning` `--warn` left bar vs panel | 1.41 | 4.41 | 3 |

cyan/light and emerald/light were probed the same way and every element passes its floor
(4.54–6.27 after, 1.45–2.70 before). steel/dark, nord/dark and midnight/dark were probed before
and after and are byte-identical — the dark and legacy sets did not move.

**Residual, deliberately not fixed here (new follow-up, item 8):** `.alert-row.critical` and
`.optimize-grade` paint text in `var(--bg)` on a `var(--warn)` fill. With the prototype's
`--warn`, that pairing lands at 4.54 (cyan), 4.56 (emerald), 4.42 (azure), 4.41 (steel), 4.38
(violet) — three palettes sit just under the 4.5 floor. This is a 3.1x improvement on the 1.41
that opened this item, and it is the prototype's own value, so it was shipped as-is rather than
inventing a darker yellow. Closing the last 0.1 needs a design decision, not a transcription.

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

## 8. Text-on-`--warn`-fill sits ~0.1 under WCAG AA in three light palettes

**Status:** open. Needs a design decision, which is why item 5 did not absorb it.

Two rules paint text in `var(--bg)` on a `var(--warn)` fill:

- `dashboard.css:335` — `.alert-row.critical { background: var(--warn); color: var(--bg); }`
  (its `.alert-title` is `700 12.5px`, so the 4.5 normal-text floor applies, not 3). Its sibling
  `.alert-detail` (`:341`) inherits the same `color: var(--bg)` and applies `opacity: .8` on top,
  so its *effective* ratio is below every figure in the table below — same rule, same fix.
- `dashboard.css:194` — `.optimize-grade { color: var(--bg); background: var(--warn); }`

With the light-mode `--warn` (`#96660f`) that item 5 introduced, that pairing measures:

| palette | `--bg-base` | ratio | floor 4.5 |
|---|---|---|---|
| emerald | `#e9f8f1` | 4.56 | pass |
| cyan | `#eaf6fb` | 4.54 | pass |
| azure | `#eef1fa` | 4.42 | short |
| steel | `#eff1f2` | 4.41 | short |
| violet | `#f3eefa` | 4.38 | short |

steel is the app's default palette, so the default light appearance is one of the short ones.

**Why it was not fixed in the same pass:** `#96660f` is copied verbatim from
`docs/prototype/index.html`, which the plan names as "the source of truth for every value", and
the prototype has no `.alert-row.critical` rule — it never puts text on an alarm fill there
(`.alert-title` is `color: var(--tx-primary)` on a normal panel). **Correction, caught by the
final-review re-review:** the prototype *does* have a counterpart for the second rule —
`.grade` (`docs/prototype/index.html:459`, rendered as `<button class="grade">SETUP C ▾</button>`
at `:755`) is `.optimize-grade`'s direct source. It is `color:#1a1204; background:var(--warn)`,
a fixed ink rather than `var(--bg)` — and it measures **worse**, not better: `#1a1204` on
`#96660f` is **3.71:1**, below even the app's current 4.41. So a verbatim prototype answer does
exist for `.optimize-grade`, but adopting it would regress this fix, not complete it. Do not pull
`#1a1204` from the prototype as "the correct fix" without re-deriving the ratio yourself — that
value was checked once already, on 2026-08-20, and it fails.

**Candidate fixes, none of them free:**

1. Repoint both rules' ink at `var(--acc-ink)`, which is already `#ffffff` in all five Aether
   light palettes. Pure white on `#96660f` measures 4.99 — clears 4.5 everywhere, verified. But
   `--acc-ink` is a dark colour in dark mode, so this changes dark rendering too and needs its
   own verification.
2. Darken the light `--warn` past the prototype's value. Clears the floor but breaks the
   "copy the prototype verbatim" constraint and desynchronises tokens.css from the prototype.
3. Accept 4.38–4.56 as close enough. Defensible — it is a 3.1x improvement over the 1.41 that
   item 5 opened with, and all other alarm UI passes comfortably — but it should be an explicit
   decision rather than a silent one.

**Related, pre-existing, and untouched by item 5:** in nord/dark, `.footer-alarm.crit`
(`--danger` `#ff6b7a` on that palette's chrome) measures 4.03 against the same 4.5 floor. That
is the shared dark alarm set on a legacy palette, unrelated to the light-mode change.
`test/contrast.test.js` does not catch either case: it covers only the nine legacy palettes and
only the `tx-*` tokens, never the alarm triple and never the five Aether palettes. Extending it
to alarm colours x 5 Aether palettes x 2 modes would have caught both, and is worth doing
alongside whichever fix is chosen.

**Adjacent, not part of this item:** `.alert-row.critical` painting a **critical** alert in
`var(--warn)` rather than `var(--danger)` looks like a pre-existing semantic mismatch, independent
of the contrast question above (found during the final-review re-review). Not investigated
further here — flagging so it isn't mistaken for something this item already covers.

**Owner:** unassigned.

---

## 9. Five panels still need a design pass before they can be reskinned

**Status:** open. Written after Task 5 (the last of the 5 slices in
`docs/plans/2026-08-13-reskin-phase-5-slices.md`), per that plan's Definition of Done.

This plan reskinned five panels by porting `docs/prototype/index.html` markup 1:1: hero tiles,
budget bars, agent lanes, the alert banner/CLI toast, and the optimize panel (this task). Five
more panels remain on the old token/typography language and were deliberately out of scope,
because none of them have a corresponding prototype section to port from:

- **Insights**
- **Settings (content)**
- **Onboarding**
- **Fleet / Team**
- **Mini mode**

Each of these needs its own short design pass — applying the same token/typography language this
plan established (`--f-ui`/`--f-mono`, the `--tx-primary`/`--tx-muted`/`--dim` triad, `--r-panel`/
`--r-chip`/`--r-tile` radii, the `--panel-grad`/`--acc-wash` card treatment) — before it can be
planned with the same level of concreteness as this plan's five tasks. The layout itself is new
invention for each, not a port, since no prototype markup exists to copy from.

**Also blocked on all five being done:** deleting the compatibility aliases (design spec §9's
"final slice", the v1 `--bg`/`--panel`/`--tx`/`--dim` names that Aether's token layer currently
shims). That deletion can't happen until every panel — including these five — has stopped
referencing the v1 alias names, which won't be true until each gets its own reskin pass.

**Owner:** unassigned.

---

## Not a code issue: rotate the deployed update token

**Owner: Matt. Not actionable in this repo.**

The auto-updater removal (commit `ccbff25`) stops any future build from bundling
`secrets/update-token.txt`. It does **not** rotate the GitHub token already present, in
plaintext, in the install directory of every machine v1 was deployed to — readable by
anyone who can browse `%LOCALAPPDATA%\Programs\Claude Token Tracker`.

Removing the feature retires the exposure going forward. Closing it retroactively
requires revoking that PAT.
