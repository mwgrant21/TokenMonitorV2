# TokenMonitor → Aether: convergence plan

Decisions taken: **full Aether aesthetic**, **React/TS port on the table**, prototype first.
This is the exhaustive list, unfiltered — triage it yourself.

---

## 1 · What the prototype actually changes

Everything below is in `tm-aether.html` and is a real, copyable technique — not a mood board.

### Surface / chrome

| Change | From | To |
|---|---|---|
| Page background | flat `#0b0e14` | `radial-gradient(1400px 900px at 60% -10%, …)`, fixed attachment |
| Panels | `background: var(--panel)` + 1px border | `linear-gradient(180deg, rgba(9,28,38,.8), rgba(6,18,26,.8))` + cyan-tinted border + inset top highlight + deep drop shadow |
| Panel radius | 12px | 14px panel / 9px tile / 7px chip — a real scale, not one value |
| Chrome bars | none (bare `<header>`) | translucent `rgba(4,16,24,.6)` + `backdrop-filter: blur(6px)` |
| Accent | fixed `--acc: #5b8cff` | `--alarm`, reassigned by alarm tier — every accent surface reads from one variable |

### Typography

- **Rajdhani** for UI (condensed, squared, letterspaced small caps) + **Space Mono** for numerals.
  The prototype embeds both as base64 woff2 (~126KB total) — no CDN, works offline in Electron.
- Label convention: `600 9px/1`, `letter-spacing: 2px`, uppercase. This single rule does more
  visual work than any gradient.
- Numerals get real hierarchy: 27px hero, 17px KPI, 11px body, 9.5px meta.

### Motion

- `breath` on the reactor core and brand mark, duration bound to `--pulse-dur`, which is bound to
  burn rate.
- `flow` on active agent lanes (already in TokenMonitor — kept, retinted).
- `scan` sweep over the terminal pane.
- `ledPulse` on status LEDs.
- `bannerIn` on the alert.
- Full `prefers-reduced-motion` block that **slows the pulse rather than freezing it** — Aether's
  reasoning holds here: a frozen reactor reads as broken, not as motion-reduced.

### New components

- **Reactor canvas** — direct port of `drawHousing.ts`: 12 segmented alloy plates, glowing vent
  slits phase-offset by `sin(a − t·2)`, seam bolts, clipped lightning filaments, ambient bloom.
  Hue-rotated by alarm tier, pulse duration by burn rate, filament density by agent concurrency.
- **Cache-hit donut** — replaces a flat percentage with a gradient-stroked arc + shadow bloom.
- **Sparkline** in the burn tile — bars turn `--alarm` past the threshold.
- **Source chips** (`LIVE` / `EST` / `STALE`) — Aether's honesty pattern, and TokenMonitor needs it
  more than Aether does: plan-scraped `/usage` data and estimated cost currently look identical.
- **Treemap with gradient fills + hover lift** — same data, reads as a chart instead of a bar.
- **Footer status strip** — version, share path, seat count, alarm state.

### The thing worth stealing most

**One alarm variable drives everything.** `html[data-alarm]` reassigns `--alarm` / `--alarm-glow` /
`--pulse-dur`, and the reactor hue, LEDs, banner, budget fills, sparkline, lane bars, tile borders,
and footer all follow without a single per-component conditional. TokenMonitor currently decides
"warn" independently in `alertEngine.js`, `budgets.js`, and `optimize.js`.

---

## 2 · The port question

### What the two repos already duplicate

These exist in **both**, with the same names and near-identical logic:

| File | TokenMonitor | Aether OS |
|---|---|---|
| `modelPricing` | `src/shared/modelPricing.js` (CJS) | `src/shared/modelPricing.ts` |
| `optimizeRules` | `src/shared/optimizeRules.js` | `src/shared/optimizeRules.ts` |
| `optimizeGrade` | `src/shared/optimizeGrade.js` | `src/shared/optimizeGrade.ts` |
| `optimizeActions` | `src/shared/optimizeActions.js` | `src/shared/optimizeActions.ts` |

The Aether README already flags the cost of this: `usageTokens()` was ported from TokenMonitor
carrying a bug, and thirteen green tests didn't catch it. **Two copies of the same pricing logic
drifting apart is a bug factory, and you've already been bitten once.** That is the strongest
argument for convergence — stronger than the visual one.

### Three viable shapes

**A · Shared design tokens only (1–2 evenings)**
Extract `tokens.ts` values into a framework-neutral `tokens.css` / `tokens.json` consumed by both.
TokenMonitor stays vanilla; you hand-write the CSS against the variables. Gets you ~70% of the
prototype's look. Zero architectural risk. Does nothing for the duplicated logic.

**B · Shared logic package + vanilla reskin (1–2 weeks)**
Pull `modelPricing` / `optimizeRules` / `optimizeGrade` / `optimizeActions` into a
`packages/core` workspace, TS source, built to both ESM and CJS. Both apps import it. TokenMonitor's
renderer stays vanilla and gets the CSS reskin from A. **This is the highest value-per-risk option** —
it kills the drift problem and gets the visuals, without rewriting a working renderer.

**C · Full React/TS port (4–8 weeks, realistically longer)**
TokenMonitor's renderer becomes React 18 + TS strict, electron-vite, and shares components with
Aether. What this actually costs:

- 18 panel modules in `src/renderer/dashboard/panels/` rewritten (~90KB of imperative DOM code)
- `index.html`'s 130 lines of inline-styled markup and 24 `<script>` tags replaced by a component tree
- The `window.TT.*` global namespace pattern replaced by a store (Aether uses one `useReducer`)
- `terminal.js` (xterm + node-pty wiring) reworked into a component — Aether already has
  `PtyTerminal.tsx`, so this one is nearly free
- Build system swapped: currently no bundler at all, just `<script>` tags off the filesystem
- `electron-builder` NSIS config revalidated against the new output paths
- `node --test` suites migrated to Vitest, or kept and run separately
- Every one of these is a chance to introduce a `usageTokens()`-class bug in code that currently works

---

## 3 · Honest pushback

Three things worth your attention before committing to C:

**The professional-credibility risk is real but smaller than it looks.** TokenMonitor ships to an IT
department. A glowing warp core on a coworker's monitor invites "is this a toy?" — but the reactor
*is* an instrument here: hue is alarm tier, pulse rate is burn, filament density is concurrency.
That's defensible in a way that pure decoration isn't. **Mitigation: ship the Aether skin as one
palette among the existing ten, defaulting to it for you and to Midnight for everyone else.** You
get the full aesthetic; the department gets a choice. This costs you nothing and removes the
objection entirely.

**The full port is the least valuable third of the work.** Options A and B deliver the visual
convergence and the correctness win. C mainly buys component sharing — and TokenMonitor has
*fleet roll-up*, *plan-aware `/usage` scraping*, *onboarding*, *mini mode*, and *export*, none of
which Aether has or wants. The genuinely shared component surface is thinner than it feels.

**You have a live cost constraint.** You've noted wanting features safe-by-default after the
$25-in-30-minutes incident. A multi-week React port done through the spec → build → review → verify
loop is a large token spend on a codebase that currently works. B gets you most of the outcome for
a fraction of it.

**My read:** do A+B, ship the reskin, and let C stay optional. If after living with the reskin you
still want shared components, you'll have the `packages/core` workspace already standing — which is
the hard part of C anyway.

---

## 4 · Sequencing (if you go A+B)

1. **`packages/core`** — move the four duplicated modules, TS source, dual ESM/CJS build. Aether
   imports it first (it's already TS, lower risk). Delete Aether's copies, run its 572 tests.
2. **TokenMonitor imports `packages/core`** — delete its copies, run `node --test`. This is the
   correctness win, banked before any visual work.
3. **`tokens.css`** — generate from `tokens.ts` so there is one source of truth. Add `aether` to
   `KNOWN_PALETTES` in `themeConfig.js`.
4. **Chrome pass** — `index.html` header/footer, fonts, radii scale, panel gradient. Biggest visual
   delta per line changed.
5. **`--alarm` unification** — one variable, driven by `alertEngine`'s existing tier output.
   Rip the per-component warn logic out of `budgets.js` / `optimize.js`.
6. **Reactor** — new `src/renderer/dashboard/panels/reactor.js`, canvas, ~120 lines ported from
   `drawHousing.ts`. Fed by the burn rate `heroTiles.js` already computes.
7. **Donut + sparkline** — same pattern, small canvases.
8. **Alert sounds** *(optional)* — Aether's `alertSounds.ts` is pure Web Audio, no assets, and
   ports as-is. Default **off** in a team build.

Steps 1–2 are worth doing even if you abandon everything else.

---

## 5 · Ideas from Aether not in the prototype

Listed for completeness — you asked for unfiltered.

- **Behavioral anomaly detectors** (`anomalyDetectors.ts`) — re-read loops, write-delete-rewrite
  churn, zero-edit burn, stalled permissions. TokenMonitor's optimize rules are all *cost*
  signatures; these are *behavior* signatures. Different axis, no overlap.
- **Alert sounds** — synthesized chirp/klaxon/chime from Web Audio oscillators.
- **Light theme** — Aether has a full `colorsLight` palette; TokenMonitor is dark-only across all
  ten themes. A department tool arguably needs a light mode more than a personal cockpit does.
- **Depletion ETA + reset countdown** (`depletion.ts`) — pairs naturally with plan-aware `/usage`.
- **Orchestration grid** — radial hub-and-spoke agent map. Would replace the flat agent lanes.
- **Dispatch timeline** — per-dispatch bands, better than the current concurrency lanes for
  answering "what was running when the spike happened".
- **Statusline payload** (`statuslinePayload.ts`) — real context-window percentage from Claude
  Code's statusline, rather than estimating.
- **`useReducedMotion` / `useHoverStyle` / `useElementHeight`** — small, well-tested, portable.
- **Persistence with schema versioning** (`persistence.ts`) — more robust than TokenMonitor's
  sanitize-on-read pattern in `uiConfig.js`.
- **The `severity` spine** (`personalitySpine.ts`) — runtime-computed 0–4 severity per dispatch.
  Even without the voice layer, a severity number is a better sort key than a boolean alert flag.

---

## 6 · Reactor display mode (added after review)

The reactor is opt-in, three rungs, persisted. Wiring notes for the real app:

**`FULL`** — the warp core. Canvas animation, lightning filaments, hue-rotated by alarm tier.
**`GAUGE`** — the professional rung. Same three signals (burn as arc fill against ceiling,
concurrency as lit pips, alarm tier as stroke colour), no plates, no filaments, no bloom. Repaints
on state change only — nothing animates, so it costs no frame budget.
**`OFF`** — reactor column removed, hero tiles reflow to `repeat(4, 1fr)`. This lands exactly on
TokenMonitor's current `hero-grid`, so OFF is a genuine fallback to today's layout wearing the new
chrome — not a hole where a panel used to be.

### Implementation notes

- The `.strip` grid goes `212px 1fr` → `1fr`; `.hero-grid` goes 2×2 → 4×1. Two CSS rules, no JS
  layout math.
- The rAF loop early-returns when `mode !== 'full'`, so OFF and GAUGE genuinely stop painting rather
  than drawing to a hidden canvas.
- **Persistence gotcha:** `ui.json` is the right home, but `src/shared/uiConfig.js#sanitize` is a
  **whitelist** — per CLAUDE.md, a new key must be added to *both* `UI_DEFAULTS` and `sanitize()` or
  it is silently dropped on read and the setting appears not to save. Add
  `reactorMode: 'gauge'` to `UI_DEFAULTS` and a `RX_MODES.includes(src.reactorMode)` branch to
  `sanitize`. The prototype uses `localStorage` as a stand-in.
- Settings placement: the existing `#settings-popover` already has an "Appearance — theme" section
  and a "Panels" toggle group. Reactor display belongs under Appearance as a third segmented
  control, next to the palette swatch grid.

### Recommended defaults

Ship **`GAUGE` as the default**, not FULL and not OFF. Rationale: the concurrency-and-burn glance is
the actual product value — a coworker who never touches Settings still gets the instrument — while
nobody has to defend a warp core they didn't ask for. FULL is then something you opt into on your
own machine, which is the same shape as the palette recommendation in §3.

---

## 7 · v2 scope lock (department build)

**Cut, per Matt — these stay in Aether OS as personal-project features:** agent personas/roster,
live feed reports, audio alerts.

**Hard constraint: zero API cost.** Nothing in v2 may reach a model. Everything in the prototype
renders client-side from local transcript JSONL and the `/usage` TUI scrape — both are reads of work
the user already paid for, not new billable calls. Recommended guardrail: port Aether's
`modelPolicyEnforcement.test.ts` pattern into TokenMonitor as a test that **fails the build** the
moment `messages.create`, an `ANTHROPIC_API_KEY` read, or an `api.anthropic.com` fetch becomes
reachable from any source file. That converts a policy into something CI enforces — worth having
before an enterprise rollout, not after.

### Instruments (5)

| Mode | Shape | Where |
|---|---|---|
| `REACTOR` | Aether warp core, animated | 212px column |
| `ARC` | 270° arc, load % centre, 8 concurrency pips | 212px column |
| `TACH-V` | Vertical bar, ticks 0–130k, redline top 23%, pips down the left | 212px column |
| `TACH-H` | Full-width HUD strip: big numeral, linear tach, redline, needle, pips | spans the pane; hero tiles reflow 4-across |
| `OFF` | none | hero tiles 4-across |

`TACH-H` is the one that most matches the HUD reference — a horizontal tach wants width, so it gets
its own full-width strip rather than being squeezed into the instrument column. `TACH-V` is the same
instrument for people who'd rather keep the column layout.

Only `REACTOR` runs an animation loop. `ARC`, `TACH-V` and `TACH-H` repaint on state change only —
the rAF loop early-returns — so the professional modes are also the cheap ones.

### Palettes

Six in the Aether language (**Cyan, Azure, Violet, Emerald, Amber, Steel**) × light/dark = 12, plus
the existing 10 flat themes carried over via `[data-lang="flat"]`. The prototype ships Midnight,
Tokyo Night and Carbon as proof the two languages coexist — **look at those next to Cyan before
committing to keeping all ten.** Side by side, the flat themes read as visibly less finished, and
that gap is the maintenance cost of two languages made visible. Options if it bothers you: retire
the flat ones, or hue-match them into the Aether language under their familiar names.

**Alarm colours are held constant across every palette.** Success/warn/danger never move, because an
alert has to mean the same thing on every desk in the department. The accent is what changes.

**Amber is the one palette with a real tradeoff** — its accent sits near `--warn`. Its dark variant
compensates by pushing warn toward orange and danger toward a hotter red; at CEILING it's still
unambiguous, but it's the palette to check first if you ever retune the alarm ramp.

**Azure** is the migration-friendly one: closest to today's `--acc: #5b8cff`, so a coworker who
liked Midnight lands somewhere familiar. **Steel** is the enterprise sleeper — no hue at all, which
makes the alarm colours pop harder than in any other palette. It's the strongest candidate for the
shipped default alongside `ARC`.

### Concurrency view

`LANES` (default) or `GRID` — a radial hub-and-spoke map, hub labelled with the live count, spokes
and nodes lit to the running sessions, dashed danger ring on a node under an anomaly. Same data,
same panel, one toggle. Lanes read better cold, which is why they stay the default for people new
to Claude Code.

### Teaching order (for onboarding new users)

The layout is deliberately top-to-bottom in order of "what do I need to know":
**instrument** (am I burning hard right now) → **hero tiles** (the four numbers that matter) →
**budgets** (am I near a cap) → **concurrency** (why is it burning) → **breakdown** (on what) →
**optimize** (what do I do about it) → **treemap** (where it all went). Someone brand new can be
taught the first three and ignore the rest until they care.

---

## 8 · Palette cuts (accessibility)

**Amber** and **Tokyo Night** are removed. Both were right calls, but for different reasons — worth
separating, because it changes what to watch for next time.

I ran a WCAG contrast audit over every palette (text and alarm colours against the composited panel
surface, 4.5:1 for body text, 3:1 for small/secondary and status colours):

| Palette | Result |
|---|---|
| Cyan, Azure, Violet, Emerald, Steel — dark **and** light | all pass |
| Midnight, Carbon (legacy) | pass |
| Amber (dark and light) | **passes contrast** |
| **Tokyo Night** | **FAILS** — `tx-muted` 2.76:1 and `tx-dim` 2.31:1 against a 3.0 floor |

So Tokyo Night is a measurable accessibility failure — your read on the wash-out was correct, and
under office glare it gets worse, since glare raises the effective black level and compresses
exactly the low-contrast end that's already failing. Cut on the numbers.

**Amber's problem is different and contrast wouldn't have caught it.** Its accent sits in the same
hue family as `--warn`, so at a glance an amber-accented dashboard *looks* mildly alarmed all the
time, and a real warn state has less to distinguish it. That's a semantic collision, not a
legibility one. Worth remembering as a rule: **an accent hue must not land within ~40° of an alarm
hue**, which rules out amber/orange and red accents for as long as warn and danger own those.

Remaining set: **Cyan, Azure, Violet, Emerald, Steel** × light/dark = 10, plus the surviving legacy
flat themes. Steel remains the recommended shipped default.

---

## 9 · Versioning for manual rollout

**Direction set: no update server.** Rollouts are pushed to devices by hand. The entire requirement
is that a user can tell you *"I'm on 2.1.7"* when they should be on 2.2.0, so you know what to hand
them. That simplifies this dramatically — and it means the first move is **deleting code, not
writing it.**

### Delete the auto-updater

`electron-updater` is wired up today and is now dead weight. Removing it takes out:

- the `electron-updater` dependency and `src/main/autoUpdate.js`
- a 4-hourly outbound network call from every seat
- the `publish` block in `electron-builder.yml` and the publish step in `npm run release`
- **the bundled `update-token.txt`** — and this is the part worth acting on

That last one is a real finding, not housekeeping. `autoUpdate.js` reads a **GitHub token from
`process.resourcesPath`**, which means a credential is sitting in plaintext inside the install
directory of every machine you deploy to. In a personal build that's a shrug. In a department
rollout it's a credential distributed to N machines with no rotation story, readable by anyone who
can browse `%LOCALAPPDATA%\Programs\Claude Token Tracker`. Since you're not using the feature,
removing it retires that exposure entirely — worth doing before the rollout, not after.

### What replaces it: nothing that phones home

**1 · `buildInfo.json`, generated at build time.** `{ version, commit, builtAt, channel }` written by
`scripts/dist.js`, read by the renderer. Never `app.getVersion()` — that's the call that's been
lying to Aether. One generated file, one source of truth, works offline by construction.

**2 · A version readout designed to be read back to you.** In the v2 prototype: a `v2.1.7` chip in
the footer that opens a panel with the number set large enough to read across a desk, the build
metadata under it, and a **COPY VERSION INFO** button that puts one line on the clipboard:

```
TokenMonitor v2.1.7 (build a3f9c21) · seat MGRANT · Windows 11 · installed 28 Jul 2026
```

Design intent: the failure mode of "what version are you on?" is never that the user refuses — it's
that they can't find it, or they read you the Claude Code version by mistake, or they give you the
number without the build so you still can't tell which of two builds they have. Big number, one
paste, and it says *TokenMonitor* in the copied string so there's no ambiguity about which version
they just sent you. Put the same block in the Settings popover — `#settings-version` already exists
there and today renders a bare string.

**3 · Automate the bump so the number is trustworthy.** This still matters with manual rollout —
arguably more, since the version is now your *only* signal. Conventional commits +
`standard-version`: `fix:` → patch, `feat:` → minor, changelog generated. `npm run dist` becomes
bump → tag → build, with no hand-edited number anywhere. Add a test that fails if a semver literal
appears outside `buildInfo.json`; that's what catches the `CLAUDE.md` 0.1.2-vs-0.1.3 drift you
already have.

**4 · Fleet version column — you may not even need to ask.** Seats already write daily snapshots to
`\\shared\claude-usage\`. Adding `appVersion` to `writeFleetSnapshot()` and a pure
`versionSpread(seats)` to `fleetAggregator.js` gives the Team view a version column and a
`3 seats behind` chip. No server, no network call — it rides on the file share you already use. The
user-readable version stays the primary path (it works for seats that never enable fleet sharing),
but this makes the common case answerable without asking anyone.

### One optional idea, not built

If you later want seats to *notice* they're behind without you chasing them: drop a
`latest.json` containing `{ "version": "2.2.0" }` into the same shared folder when you cut a build.
The app already reads that folder; comparing two strings locally is free. A seat that's behind shows
a quiet `UPDATE AVAILABLE — contact IT` chip. Still no server, still manual rollout, no outbound
network — just one more file on a share you already have. Say the word and I'll add it; leaving it
out otherwise, since you were clear about not wanting update checking.

### Sequencing

1. Remove `electron-updater`, `autoUpdate.js`, the publish config, and the bundled token
2. `buildInfo.json` generation + renderer reads it (this alone fixes Aether's phantom v1.0.0)
3. Footer version chip + copy button, and the same block in Settings
4. `appVersion` in the fleet snapshot + `versionSpread` + Team column
5. Conventional commits driving the bump, and the no-hardcoded-version test
6. Fix the version line in `CLAUDE.md` — or better, delete it and let the generated file own it
