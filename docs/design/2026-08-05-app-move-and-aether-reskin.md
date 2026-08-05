# v2: move the app into this repo, then reskin it in the Aether language

Design spec. Supersedes nothing; implements sections 1-4 of
[`aether-convergence-plan.md`](./aether-convergence-plan.md) with two of its assumptions corrected
(see [Correction to the convergence plan](#correction-to-the-convergence-plan)).

Status: **approved, not started.** Written 2026-08-05.

---

## 1 - What this project is

The v1 Electron app lives in [`mwgrant21/TokenMonitor`](https://github.com/mwgrant21/TokenMonitor)
(locally `~/claude-token-tracker`, v0.1.2, branch `master`). This repo holds `packages/core`, the
version-readout logic, the design prototype and the plans, but — per its own README — not the
application.

This project moves the application here and restyles it into the Aether visual language.

**In scope:** the move, retiring the auto-updater, consuming `packages/core`, the token layer, the
chrome pass, and restyling the ten existing renderer panels.

**Out of scope, deliberately:** the five instruments (Reactor / Arc / Tach-V / Tach-H / Off). They
are new components rather than restyles of existing ones, and get their own spec once the reskin
lands. Also out: the React/TS port, argued against at length in the convergence plan §2C and not
revisited here.

---

## 2 - Decisions taken

| # | Decision | Rationale |
|---|---|---|
| 1 | The app moves into this repo; v1 freezes to maintenance | v2 becomes the genuine home rather than a parts bin. Fixes the `packages/core` wiring for free (see §4). |
| 2 | Move everything as-is first, reskin second | Move and restyle stay separately attributable. A regression during the reskin has one obvious cause. |
| 3 | Retiring the auto-updater stays in this project | It is a prerequisite for a department rollout, not unrelated cleanup. See §5. |
| 4 | 19 palettes: Aether 5 x light/dark, plus the 9 surviving legacy flat themes | No coworker loses the theme they already picked. Cost is two visual languages maintained in parallel; the prototype already carries the `[data-lang="flat"]` mechanism for exactly this. |
| 5 | Token layer first, then one panel per slice | Every slice is independently shippable and reviewable. |
| 6 | Native OS window chrome is kept | The look comes from styling the in-app header, not from `frame: false`. No new platform code, and mini mode's `setResizable(false)` workaround is left alone. |

Tokyo Night stays cut (WCAG failure: `tx-muted` 2.76:1, `tx-dim` 2.31:1 against a 3:1 floor).
Amber stays cut (accent hue within ~40 degrees of `--warn`, so the dashboard reads faintly alarmed
at rest). Both per convergence plan §8.

---

## 3 - Correction to the convergence plan

The convergence plan's step 3 says to generate `tokens.css` from Aether OS's `src/styles/tokens.ts`
"so there is one source of truth." **That is not viable, and the prototype is the better source.**

Aether OS defines exactly **one** CSS custom property in the entire repo (`--pulse-dur`, in
`src/styles/global.css`). Its colours are TypeScript objects consumed as React inline style objects
through a `useColors()` hook — a mechanism that exists only because Aether is React. Its `radii`
export is dead code, imported nowhere; `space` is imported by 2 of the 49 component files that
import from `tokens.ts`. Every other component hardcodes `borderRadius: 14` and `gap: 12` inline.
Generating from it would yield colours and nothing else.

`docs/prototype/index.html` already defines **34 CSS custom properties** and implements all 19
palettes as `html[data-pal][data-mode]` and `html[data-lang="flat"]` blocks, plus `[data-alarm]`,
`[data-inst]` and `[data-agents]` state selectors. That is the same mechanism v1 already themes
with (`[data-palette]` + custom properties), in the same language.

**The prototype is the source of truth for the reskin. Aether OS is visual reference only.**

---

## 4 - Phase 0: move the app, change nothing

v1 has no bundler and no build step — the renderer is plain `<script>` tags loaded in dependency
order — so this is a file move, not a migration.

Moves: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`, `test/`, `scripts/`,
`electron-builder.yml`, plus the runtime dependencies (`electron`, `node-pty`, `xterm@^5.3.0`,
`xterm-addon-fit@^0.8.0`).

Does not move: `secrets/` (gitignored, and see §5), `.worktrees/`, the merged `design-v2-phase1/2/3`
branches.

**The app becomes the root package** of this workspace. The root `package.json` already declares
`workspaces: ["packages/*"]`, so `@tokenmonitor/core` resolves as a workspace dependency.

This is a real fix, not just tidiness. v1's in-progress wiring branch declares
`"@tokenmonitor/core": "file:C:/Users/IT/Desktop/TokenMonitorV2/packages/core"` — an absolute path
containing this machine's home directory, which cannot resolve on the `mwgrant21` or `matthewgr`
machines. Workspace resolution removes the path entirely.

**Exit criterion:** the app launches, all ten panels render, existing `node --test` suites pass, and
there is no visual difference from v1. Phase 0 must be provably a no-op.

---

## 5 - Phase 1: retire the auto-updater

Delete `electron-updater`, `src/main/autoUpdate.js`, the `extraResources` block at
`electron-builder.yml:10-12`, the `publish` block at `:13`, and the publish path in `scripts/dist.js`.

**Why this is a prerequisite rather than housekeeping.** `electron-builder.yml:10-12` copies
`secrets/update-token.txt` into every built package, and `autoUpdate.js:11` reads it back from
`process.resourcesPath`. A 93-byte GitHub token therefore sits in plaintext in the install directory
of every already-deployed machine, readable by anyone who can browse
`%LOCALAPPDATA%\Programs\Claude Token Tracker`. The feature is unused — rollout is manual by
decision — so removing it retires the exposure entirely.

**The token is not in git.** `secrets/` is gitignored and no credential file is tracked; the move
carries nothing into this repo's history.

**Open item, owner: Matt.** Removing the updater stops *future* distribution. It does not rotate the
token already sitting on deployed machines. Rotation is a human decision and is not part of this
project's implementation.

---

## 6 - Phase 2: consume `packages/core`

Delete v1's `src/shared/{modelPricing,optimizeRules,optimizeGrade,optimizeActions}.js` and import
from `@tokenmonitor/core`. The package already resolves the two divergences documented in this
repo's README (`eventTimestampMs` type handling and the `findUncappedBashOutput` field mismatch),
and v1's four original test files pass against it unmodified with only the `require` path rewritten.

Phases 0-2 are worth completing even if the reskin is abandoned. They are the correctness win,
banked before any visual work.

---

## 7 - Phase 3: the token layer

Create `src/renderer/styles/tokens.css` by extracting the prototype's `:root` block and its 19
palette blocks, preserving the prototype's selector scheme verbatim:

- `html[data-pal="cyan|azure|violet|emerald|steel"][data-mode="dark|light"]` — the Aether ten
- `html[data-lang="flat"]` plus `html[data-pal="<slug>"]` — the legacy nine

The 34 properties: `--bg-base`, `--page-radial`, `--panel-grad`, `--panel-bd`, `--panel-inset`,
`--chrome-bg`, `--chrome-bd`, `--chip-bd`, `--active-bd`, `--bg-term`, `--tx-primary`, `--tx-body`,
`--tx-secondary`, `--tx-muted`, `--tx-dim`, `--acc`, `--acc-deep`, `--acc-soft`, `--acc-glow`,
`--acc-ink`, `--acc-wash`, `--success`, `--warn`, `--danger`, `--alarm`, `--alarm-glow`,
`--pulse-dur`, `--r-panel`, `--r-tile`, `--r-chip`, `--f-ui`, `--f-mono`, `--flat-panel`,
`--flat-panel2`, `--flat-bd`.

(Verified against the prototype: exactly these 34, no more. There is no `--acc-soft` — the
prototype's accent ramp is `--acc` / `--acc-deep` / `--acc-glow` / `--acc-ink` / `--acc-wash`.)

### The compatibility layer

v1 defines **ten** palette variables at `dashboard.css:2-5` (`--bg`, `--panel`, `--panel2`, `--bd`,
`--tx`, `--dim`, `--acc`, `--acc2`, `--warn`, `--soft`). Eight need aliasing onto the new names so
every existing rule in `dashboard.css` keeps working untouched:

```css
/* Compatibility aliases. Deleted in the final slice, once no rule references them. */
:root {
  --bg:     var(--bg-base);
  --panel:  var(--panel-grad);
  --panel2: var(--flat-panel2);
  --bd:     var(--panel-bd);
  --tx:     var(--tx-primary);
  --dim:    var(--tx-dim);
  --soft:   var(--acc-wash);
  --acc2:   var(--acc-deep);   /* judgment call - see below */
}
```

`--acc` and `--warn` keep their names and need no alias.

`--acc2` is the one alias that is a mapping rather than a rename. In v1 it is a fixed teal
(`#2dd4bf`) used as the second colour in the treemap cycle at `activity.js:45`
(`['var(--acc)','var(--acc2)','var(--warn)','var(--panel2)','var(--dim)']`). The Aether language has
no direct equivalent, so it maps to `--acc-deep` as a secondary accent tone. Check the treemap
specifically when this lands — it is the one surface where the alias could read wrong, and it goes
away entirely when the treemap is restyled in Phase 5 slice 3.

This is what makes Phase 3 shippable on its own: the app immediately gains Rajdhani/Space Mono, the
14/9/7 radius scale, the panel gradient and the translucent chrome, with no markup changed.

### Palette escapes fixed in this slice

Three hardcoded values currently bypass the palette system and would otherwise survive the reskin
invisibly:

| Value | Locations |
|---|---|
| `#ff6b6b` (error red) | `dashboard.css:58`, `:133`, `:385` |
| `#0b0e14` (body background) | inline `style` attribute on `<body>`, `index.html:10` |
| `#0b0e14` / `#e7ebf3` (xterm defaults) | `terminal.js:13` |

### Fonts

Self-hosted via `@fontsource` files on disk with `@font-face` rules — Rajdhani 400/500/600/700 and
Space Mono 400/700. The prototype base64-embeds them (~126KB) because it is a single portable file;
in Electron, files on disk give the same offline guarantee without the embedded payload.

The split is the single biggest carrier of the look and must be applied strictly:
**Rajdhani for every label, Space Mono for every number.**

### Contrast audit

All nine legacy palettes are audited in this slice. Only Midnight and Carbon have ever been
measured; Nord, OneDark, Solarized, Catppuccin, GitHub and Graphite have not. Expect at least one
further casualty.

The audit ships as an automated test (see §10), not a one-time manual pass.

---

## 8 - Phase 4: the chrome pass

Native `BrowserWindow` options are unchanged. The only main-process change is
`Menu.setApplicationMenu(null)` to drop the default Electron menu bar.

The prototype's chrome styling is applied to the existing in-app `<header>`:
`background: rgba(4,16,24,.6)`, `backdrop-filter: blur(6px)`, `--chrome-bd` border. A footer status
strip is added (version chip, share path, seat count, alarm state) per convergence plan §1.

This slice also begins the inline-style extraction, which is the largest mechanical cost in the
project: `index.html` alone carries 40 `style=` attributes, covering the entire header, both
segmented controls, the settings popover and the top-level flex layout. Inline styles override
stylesheets, so any rule targeting those surfaces silently does nothing until they are removed.

**Non-goal: Aether's fixed design canvas.** Aether renders into a hardcoded 1536x1024 frame scaled
by `Math.min(vw/1536, vh/1024)` — it zooms rather than reflows. v1 uses real flex layout with a
draggable terminal/dashboard divider and a 340x520 mini mode. v1's behaviour is correct for a tool
run at arbitrary sizes on department hardware. We take the look, not the scaling model.

---

## 9 - Phase 5: panel slices

One slice each, in this order. Each replaces that panel's `innerHTML` template with the prototype's
markup and deletes its inline styles.

| # | Slice | Notes |
|---|---|---|
| 1 | Hero tiles | Highest visibility, simplest markup; proves the tile radius and type scale |
| 2 | Budgets + `--alarm` unification | See below |
| 3 | Agents lanes + treemap | Existing `@keyframes flow` retints rather than being rewritten |
| 4 | Alerts banner + CLI toast | Consumes the `--alarm` tier from slice 2 |
| 5 | Optimize | Largest panel at 257 lines, but self-contained |
| 6 | Insights | Includes retinting the hand-rolled SVG trend chart in `insights.js:17-30` |
| 7 | Settings popover | Dense inline-style concentration; also gains the palette and light/dark controls |
| 8 | Onboarding | 285 lines, the most inline styles in the repo |
| 9 | Fleet / Team view | Separate stylesheet (`fleet.css`), lowest daily visibility |
| 10 | Mini mode | Small surface, but shares the budget-fill vocabulary |

Final slice: delete the compatibility aliases from §7 once no rule references them.

### The `--alarm` unification (slice 2)

The convergence plan calls this "the thing worth stealing most." One variable reassigned by
`html[data-alarm]` drives the alarm colour, glow and pulse duration; every accent surface follows
without a per-component conditional.

v1 currently decides "warn" independently in three places, with the threshold `78` repeated as a
literal in `budgets.js:7`, `budgets.js:42` and `miniMode.js:22`. This slice removes those and drives
the cascade from `alertEngine`'s existing tier output.

**The panel data seam is already clean.** `dashboard.js` is 22 lines that fan one precomputed state
object out to seven `TT.*.render(state)` calls, and panels never fetch their own data. Restyling a
panel touches only its template, not its data path.

---

## 10 - Verification

**Phase 0:** app launches, ten panels render, `node --test` passes, no visual difference. Mechanical.

**Per slice:** manual comparison against the prototype rendered side by side. No visual-regression
tooling — at ten slices the setup cost outweighs the benefit.

**Two automated guardrails built during this project:**

1. **Contrast test.** Computes contrast ratios for every `--tx-*` against its palette's composited
   panel surface across all 19 palettes, failing below the 4.5:1 (body) and 3:1 (secondary/status)
   floors. Runs in `node --test` with no browser, since every value lives in `tokens.css`. Tokyo
   Night shipped failing and stayed shipped until someone measured it by hand; with 19 palettes a
   manual audit is guaranteed to rot.

2. **Zero-API-cost test.** Fails the build if `messages.create`, an `ANTHROPIC_API_KEY` read, or an
   `api.anthropic.com` fetch becomes reachable from any source file. Aether OS has already
   implemented this as `src/shared/noApiCalls.test.ts` during its Stage 13.5 teardown — port that
   rather than reinventing the pattern.

Both convert a policy into something CI enforces, which is worth having before an enterprise
rollout rather than after.

---

## 11 - Risks

**The inline-style extraction is the real cost.** It is unglamorous, touches every panel, and is
easy to underestimate because the CSS work looks like the hard part. It is not.

**Two visual languages, permanently.** Keeping the legacy flat themes means every future token
change is checked twice, and the flat themes will keep reading as less finished next to the Aether
five. That was an accepted trade, but it does not go away.

**Six unaudited palettes.** Nord, OneDark, Solarized, Catppuccin, GitHub and Graphite have never
been contrast-checked. If several fail, decision 4 gets revisited with real numbers rather than
preference.

**Instruments are deferred, and the layout assumes them.** The prototype's `.strip` grid is
`212px 1fr` with the instrument column, collapsing to `1fr` when the instrument is off. Shipping the
reskin without instruments means shipping the `off` layout, which the prototype explicitly supports
— but the hero grid reflow (2x2 to 4x1) must be correct from the start, or slice 1 has to be redone
when instruments land.
