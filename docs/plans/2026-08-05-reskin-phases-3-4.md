# Reskin Phases 3-4 (token layer + chrome) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the running app the Aether visual language — fonts, radii scale, panel gradient,
translucent chrome, 19 palettes across light and dark — without changing any panel's markup.

**Architecture:** A new `src/renderer/styles/tokens.css` defines 34 CSS custom properties, switched
by `html[data-pal][data-mode]` and `html[data-lang]`, copied verbatim from the design prototype.
A compatibility alias block maps v1's ten existing variables onto the new names, so every rule in
`dashboard.css` keeps working untouched while the app immediately inherits the new look. Panel
markup is untouched until Phase 5.

**Tech Stack:** Vanilla CSS custom properties, no bundler, no preprocessor. `@fontsource` files on
disk. `node --test` for the contrast audit.

**Source spec:** [`docs/design/2026-08-05-app-move-and-aether-reskin.md`](../design/2026-08-05-app-move-and-aether-reskin.md), phases 3-4.
**Prototype (source of truth for every value):** `docs/prototype/index.html`.

## Global Constraints

- **Node 22+.** CommonJS. No bundler. No ESM in `src/`.
- **Zero API cost.** Nothing may reach a model API or add a network call.
- **UTF-8 without BOM, ASCII only** in source and config.
- **Copy token values verbatim from the prototype by line range. Do not retype them.** Every hex
  value, gradient and rgba in this design already exists at a known location in
  `docs/prototype/index.html`. Transcribing them by hand is how a wrong colour ships silently.
- **No panel markup changes.** This plan touches `index.html`'s `<head>`, the header, a new footer,
  stylesheets, and persistence. It does not touch any `TT.*.render()` template. If a task tempts you
  to rewrite a panel's `innerHTML`, stop — that is Phase 5.
- **The app must run and look coherent after every task.** No task may leave the app half-themed.
- **Shell:** Git Bash for file work; PowerShell for launching Electron (a foreground `sleep` in Bash
  is blocked). Kill only this app's processes: filter on `$_.Path -like "*TokenMonitorV2*"`.

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `src/renderer/styles/tokens.css` | **New.** 34 properties, `:root` + 10 Aether palette blocks + flat-language block + 9 legacy palettes | 1, 2 |
| `src/renderer/styles/fonts.css` | **New.** `@font-face` for Rajdhani 400/500/600/700 and Space Mono 400/700 | 3 |
| `src/renderer/fonts/**` | **New.** Self-hosted woff2 files copied from `@fontsource` | 3 |
| `src/renderer/index.html` | `<head>` gains two stylesheet links; `<body>` loses its inline background; header restyled; footer added | 1, 4, 7, 8 |
| `src/renderer/dashboard/dashboard.css` | Three hardcoded `#ff6b6b` replaced with `var(--danger)` | 4 |
| `src/renderer/terminal/terminal.js` | xterm constructor defaults read tokens instead of hardcoded hex | 4 |
| `src/shared/themeConfig.js` | `KNOWN_PALETTES` grows to 19; gains `mode` and `lang`; **`saveThemeConfig` must stop dropping unknown keys** | 5 |
| `src/shared/uiConfig.js` | Untouched — theme state lives in `themeConfig`, not here | — |
| `src/renderer/dashboard/panels/settingsPanel.js` | Palette grid rebuilt for 19; light/dark toggle added | 6 |
| `test/tokens.test.js` | **New.** Every palette defines all 34 properties | 1, 2 |
| `test/contrast.test.js` | **New.** WCAG audit across all 19 palettes | 2 |
| `test/themeConfig.test.js` | Existing — extended for the new slugs, mode, and lang round-trip | 5 |

---

## The two traps in this plan

Both are the same defect class — **a persisted-state writer that silently discards fields it does
not know about** — and both will present as "the setting doesn't save" with no error anywhere.

**Trap 1 — `themeConfig.js:44`.** `saveThemeConfig` writes
`JSON.stringify({ theme: validated }, null, 2)`. It does not spread the incoming object. Add a
`mode` key and call `saveThemeConfig({ theme, mode })` and the `mode` is silently dropped on write;
the next load returns the default and the toggle appears not to work. **Task 5 must change both
`loadThemeConfig` and `saveThemeConfig`, and prove the round-trip with a test, not by eye.**

**Trap 2 — `uiConfig.js:26` `sanitize()`** is a whitelist that rebuilds the object key by key. Any
key not named there is dropped on read. This plan deliberately puts theme state in `themeConfig.js`
rather than `uiConfig.js` to avoid touching it — but if you decide to store anything in `ui.json`,
it must be added to **both** `UI_DEFAULTS` and `sanitize()`.

---

### Task 1: The Aether token layer, wired in behind compatibility aliases

**Files:**
- Create: `src/renderer/styles/tokens.css`, `test/tokens.test.js`
- Modify: `src/renderer/index.html` (`<head>` only)

**Interfaces:**
- Produces: 34 CSS custom properties resolvable from any rule, switched by
  `html[data-pal="<slug>"][data-mode="dark|light"]` and `html[data-lang="aether|flat"]`. v1's ten
  variables (`--bg`, `--panel`, `--panel2`, `--bd`, `--tx`, `--dim`, `--acc`, `--acc2`, `--warn`,
  `--soft`) remain resolvable via aliases.

- [ ] **Step 1: Write the failing structural test**

Create `test/tokens.test.js`. It parses `tokens.css` as text — no browser needed.

```js
// test/tokens.test.js
// Every palette must define the full token set. A palette missing one property
// inherits it from whichever block cascaded last, which reads as "one theme has a
// wrong colour" and is near-impossible to spot by eye across 19 palettes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'styles', 'tokens.css'), 'utf8');

// The 34 properties, verbatim from docs/prototype/index.html. There is no --acc-soft.
const TOKENS = [
  'bg-base', 'page-radial', 'panel-grad', 'panel-bd', 'panel-inset',
  'chrome-bg', 'chrome-bd', 'chip-bd', 'active-bd', 'bg-term',
  'tx-primary', 'tx-body', 'tx-secondary', 'tx-muted', 'tx-dim',
  'acc', 'acc-deep', 'acc-ink', 'acc-glow', 'acc-wash',
  'success', 'warn', 'danger', 'alarm', 'alarm-glow',
  'pulse-dur', 'r-panel', 'r-tile', 'r-chip', 'f-ui', 'f-mono',
  'flat-panel', 'flat-panel2', 'flat-bd',
];

const AETHER = ['cyan', 'azure', 'violet', 'emerald', 'steel'];

function blockFor(selector) {
  const i = CSS.indexOf(selector);
  assert.notStrictEqual(i, -1, `selector not found: ${selector}`);
  const open = CSS.indexOf('{', i);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

test('the 34 token names are all defined somewhere', () => {
  const missing = TOKENS.filter((t) => !CSS.includes(`--${t}:`));
  assert.deepStrictEqual(missing, [], `never defined: ${missing.join(', ')}`);
});

test('every Aether palette defines a full colour set in both modes', () => {
  // Properties each palette block must set itself rather than inherit.
  const PER_PALETTE = [
    'bg-base', 'page-radial', 'panel-grad', 'panel-bd', 'panel-inset',
    'chrome-bg', 'chrome-bd', 'chip-bd', 'active-bd', 'bg-term',
    'tx-primary', 'tx-body', 'tx-secondary', 'tx-muted', 'tx-dim',
    'acc', 'acc-deep', 'acc-ink', 'acc-glow', 'acc-wash',
  ];
  const problems = [];
  for (const pal of AETHER) {
    for (const mode of ['dark', 'light']) {
      const body = blockFor(`html[data-pal="${pal}"][data-mode="${mode}"]`);
      for (const t of PER_PALETTE) {
        if (!body.includes(`--${t}:`)) problems.push(`${pal}/${mode} missing --${t}`);
      }
    }
  }
  assert.deepStrictEqual(problems, []);
});

test('alarm colours are identical across every palette', () => {
  // An alert must mean the same thing on every desk. Only the accent changes.
  const offenders = AETHER.flatMap((pal) => ['dark', 'light'].map((mode) => {
    const body = blockFor(`html[data-pal="${pal}"][data-mode="${mode}"]`);
    return ['success', 'warn', 'danger'].some((t) => body.includes(`--${t}:`))
      ? `${pal}/${mode} overrides an alarm colour` : null;
  })).filter(Boolean);
  assert.deepStrictEqual(offenders, []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test test/tokens.test.js
```

Expected: **FAIL** with `ENOENT ... tokens.css`. The file does not exist yet.

- [ ] **Step 3: Create `tokens.css` by copying the prototype verbatim**

Do **not** retype any value. Extract the exact line ranges from `docs/prototype/index.html`:

| Prototype lines | Content |
|---|---|
| 22-29 | `:root` — fonts, radii, `--pulse-dur`, alarm colours, `--alarm`/`--alarm-glow` |
| 34-47 | `html[data-pal="cyan"][data-mode="dark"]` |
| 48-61 | azure dark |
| 62-75 | violet dark |
| 76-89 | emerald dark |
| 90-103 | steel dark |
| 106-119 | cyan light |
| 120-133 | azure light |
| 134-147 | violet light |
| 148-161 | emerald light |
| 162-175 | steel light |
| 182-202 | `html[data-lang="flat"]` block and its `!important` overrides |
| 204-217 | `html[data-pal="midnight"]` and `html[data-pal="carbon"]` |

A reliable extraction:

```bash
cd ~/Desktop/TokenMonitorV2
mkdir -p src/renderer/styles
{
  echo "/* src/renderer/styles/tokens.css"
  echo "   Copied verbatim from docs/prototype/index.html. The prototype is the source of"
  echo "   truth for every value here; edit it there first, then re-extract. */"
  echo
  sed -n '22,29p;34,175p;182,217p' docs/prototype/index.html
} > src/renderer/styles/tokens.css
```

Then read the result and confirm it contains no stray HTML, no `<style>` tag, and balanced braces.
Adjust the ranges if the file has shifted — **verify against the file, do not trust these numbers.**

- [ ] **Step 4: Append the compatibility alias block**

This is what lets the app keep working with zero markup changes. Append to `tokens.css`:

```css
/* ---------------------------------------------------------------------------
   Compatibility aliases: v1's ten palette variables mapped onto the new names.
   Every existing rule in dashboard.css resolves through these unchanged.
   DELETED in the final slice of Phase 5, once no rule references them.
   --------------------------------------------------------------------------- */
:root {
  --bg:     var(--bg-base);
  --panel:  var(--panel-grad);
  --panel2: var(--panel-inset);
  --bd:     var(--panel-bd);
  --tx:     var(--tx-primary);
  --dim:    var(--tx-dim);
  --soft:   var(--acc-wash);
  --acc2:   var(--acc-deep);
}
```

`--acc` and `--warn` keep their names and need no alias.

`--acc2` is the one alias that is a mapping rather than a rename: in v1 it is a fixed teal
(`#2dd4bf`), used only as the second colour of the treemap cycle at `activity.js:45`. `--acc-deep` is
the nearest equivalent. Look at the treemap when this lands — it is the one surface where the alias
could read wrong.

- [ ] **Step 5: Set the defaults on `:root` and link the stylesheet**

`tokens.css` must apply even before JS runs, so the app never flashes unstyled. In
`src/renderer/index.html`, add to `<head>` **before** the existing `dashboard.css` link (order
matters — later stylesheets win):

```html
<link rel="stylesheet" href="styles/tokens.css">
```

And set the starting attributes on the `<html>` element so the cascade has a palette before the boot
IIFE runs:

```html
<html lang="en" data-pal="steel" data-mode="dark" data-lang="aether">
```

Steel + dark is the spec's shipped default.

- [ ] **Step 6: Run the structural test**

```bash
node --test test/tokens.test.js
npm test
```

Expected: `tokens.test.js` passes all three tests; the full suite stays green (it does not read CSS).

- [ ] **Step 7: Look at the app**

```powershell
cd "$env:USERPROFILE\Desktop\TokenMonitorV2"
$p = Start-Process -FilePath "node_modules\.bin\electron.cmd" -ArgumentList "." -PassThru
Start-Sleep -Seconds 14
if ($p.HasExited) { "EXITED code $($p.ExitCode)" } else { "RUNNING" }
Get-Process -Name electron -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle } | Select-Object Id, MainWindowTitle
```

**This is the first visible change of the whole reskin.** Expect: panels now sit on the Steel
gradient with cyan-tinted borders and a 14px radius, text in the new colour ramp. Expect fonts to
still be wrong — Rajdhani and Space Mono are not installed until Task 3, so `--f-ui` falls through to
Bahnschrift/Segoe and `--f-mono` to Consolas. That is expected at this step, not a defect.

Confirm nothing is *illegible* — no black-on-black, no invisible text. If a panel looks broken rather
than merely unfinished, stop and report which one.

```powershell
Get-Process -Name electron -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "*TokenMonitorV2*" } | Stop-Process -Force
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/styles/tokens.css src/renderer/index.html test/tokens.test.js
git commit -m "feat(reskin): Aether token layer behind compatibility aliases

34 CSS custom properties copied verbatim from docs/prototype/index.html:
five palettes x light/dark, the flat-language block, and midnight/carbon.

Compatibility aliases map v1's ten variables onto the new names, so every
rule in dashboard.css keeps working with no markup changed. The app
inherits the panel gradient, radius scale and colour ramp immediately;
fonts land in a later task.

test/tokens.test.js asserts each palette defines its full set - a palette
missing one property silently inherits from whichever block cascaded
last, which is near-impossible to spot by eye across 19 palettes - and
that no palette overrides an alarm colour."
```

---

### Task 2: Translate the seven remaining legacy palettes

**Files:**
- Modify: `src/renderer/styles/tokens.css`, `test/tokens.test.js`
- Create: `test/contrast.test.js`

**Interfaces:**
- Consumes: the flat-language block from Task 1.
- Produces: all nine surviving legacy palettes defined in the new token format.

**The prototype only ships two of them.** It defines `midnight` and `carbon` as proof the two visual
languages coexist. The other seven — `slate`, `nord`, `onedark`, `solarized`, `catppuccin`, `github`,
`graphite` — exist only in v1's ten-variable format at `dashboard.css:6-41` and must be translated.
`tokyonight` is **not** translated: it fails WCAG and is cut.

- [ ] **Step 1: Derive the mapping from the two worked examples**

`midnight` in v1 (`dashboard.css:2-5`) versus `midnight` in the prototype (line 204) gives the recipe:

| Flat-language token | Source |
|---|---|
| `--bg-base` | v1 `--bg` |
| `--flat-panel` | v1 `--panel` |
| `--flat-panel2` | v1 `--panel2` |
| `--flat-bd` | v1 `--bd` |
| `--bg-term` | v1 `--bg` |
| `--tx-primary` | v1 `--tx` |
| `--tx-body` | v1 `--tx` (same value — midnight sets both to `#e7ebf3`) |
| `--tx-muted` | v1 `--dim` (exact: midnight `#7d8799` in both) |
| `--acc` | v1 `--acc` |
| `--acc-ink` | v1 `--bg` |
| `--tx-secondary` | **derived** — between `--tx` and `--dim` (midnight: `#9aa4b5`) |
| `--tx-dim` | **derived** — below `--dim` (midnight: `#6c7688`) |
| `--acc-deep` | **derived** — a darker `--acc` (midnight: `#3f6fe0`) |

v1's `--acc2` and `--soft` are dropped; `--warn` is global now and must not be redefined per palette.

Three values per palette are derived rather than copied. **Those three are exactly what the contrast
audit in Step 3 exists to check** — a derived `--tx-dim` is precisely how Tokyo Night failed.

- [ ] **Step 2: Add the seven blocks**

Append to the legacy section of `tokens.css`, following the midnight/carbon shape exactly. Read each
source palette from `src/renderer/dashboard/dashboard.css` — do not work from memory.

- [ ] **Step 3: Write the contrast audit**

Create `test/contrast.test.js`. This is the guardrail that stops a second Tokyo Night.

```js
// test/contrast.test.js
// Tokyo Night shipped failing WCAG (tx-muted 2.76:1, tx-dim 2.31:1) and stayed
// shipped until someone measured it by hand. With 19 palettes a manual audit is
// guaranteed to rot, so this runs on every commit.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'styles', 'tokens.css'), 'utf8');

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function blockFor(selector) {
  const i = CSS.indexOf(selector);
  assert.notStrictEqual(i, -1, `selector not found: ${selector}`);
  const open = CSS.indexOf('{', i);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

function token(body, name) {
  const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(body);
  return m ? m[1].trim() : null;
}

// 4.5:1 for body text, 3:1 for secondary and status text (WCAG AA).
const FLOORS = { 'tx-primary': 4.5, 'tx-body': 4.5, 'tx-secondary': 3, 'tx-muted': 3, 'tx-dim': 3 };

const LEGACY = ['midnight', 'slate', 'carbon', 'nord', 'onedark',
                'solarized', 'catppuccin', 'github', 'graphite'];

test('every legacy palette meets its WCAG floors against its own panel', () => {
  const failures = [];
  for (const pal of LEGACY) {
    const body = blockFor(`html[data-pal="${pal}"]`);
    const bg = token(body, 'flat-panel');
    assert.ok(bg, `${pal}: no --flat-panel`);
    for (const [name, floor] of Object.entries(FLOORS)) {
      const fg = token(body, name);
      if (!fg) continue;
      const r = ratio(fg, bg);
      if (r < floor) failures.push(`${pal} --${name}: ${r.toFixed(2)}:1 < ${floor}:1`);
    }
  }
  assert.deepStrictEqual(failures, [], `WCAG failures:\n${failures.join('\n')}`);
});

test('tokyonight is not present - it was cut on measurement', () => {
  assert.ok(!CSS.includes('data-pal="tokyonight"'),
    'tokyonight fails WCAG (tx-muted 2.76:1, tx-dim 2.31:1) and must not be reintroduced');
});
```

- [ ] **Step 4: Run it and expect real failures**

```bash
node --test test/contrast.test.js
```

**Expect at least one palette to fail.** Six of these nine have never been measured. This is the
step where the audit earns its place — do not tune the test to pass.

For each failure, lighten the offending derived value until it clears its floor, keeping the palette
recognisably itself. Record every value you changed and its before/after ratio in your report. **If a
palette cannot clear the floor without losing its identity, stop and report it** — that is a
cut-or-keep decision for the repo owner, exactly as Tokyo Night was, and not yours to make.

- [ ] **Step 5: Extend the structural test to the legacy nine**

Add `LEGACY` coverage to `test/tokens.test.js` asserting each defines the thirteen flat-language
tokens from Step 1's table.

- [ ] **Step 6: Full suite, then commit**

```bash
npm test
git add src/renderer/styles/tokens.css test/tokens.test.js test/contrast.test.js
git commit -m "feat(reskin): translate the seven remaining legacy palettes, audited

The prototype shipped only midnight and carbon in the new token format,
as proof the two visual languages coexist. slate, nord, onedark,
solarized, catppuccin, github and graphite are translated here from v1's
ten-variable blocks in dashboard.css.

Three values per palette (--tx-secondary, --tx-dim, --acc-deep) have no
v1 source and are derived. test/contrast.test.js measures all of them:
Tokyo Night shipped failing WCAG at tx-muted 2.76:1 and tx-dim 2.31:1
and nobody knew until it was measured by hand, which does not scale to
nineteen palettes. tokyonight stays cut, and the test enforces it."
```

---

### Task 3: Self-hosted fonts

**Files:**
- Create: `src/renderer/fonts/**`, `src/renderer/styles/fonts.css`
- Modify: `src/renderer/index.html`

**Interfaces:**
- Produces: Rajdhani (400/500/600/700) and Space Mono (400/700) resolvable offline, so `--f-ui` and
  `--f-mono` hit their first choice instead of falling through.

**The Rajdhani/Space Mono split is the single biggest carrier of the look:** Rajdhani for every
label, Space Mono for every number. It does more visual work than any gradient.

- [ ] **Step 1: Vendor the woff2 files**

```bash
cd ~/Desktop/TokenMonitorV2
npm install --save-dev @fontsource/rajdhani @fontsource/space-mono
mkdir -p src/renderer/fonts
cp node_modules/@fontsource/rajdhani/files/rajdhani-latin-{400,500,600,700}-normal.woff2 src/renderer/fonts/
cp node_modules/@fontsource/space-mono/files/space-mono-latin-{400,700}-normal.woff2 src/renderer/fonts/
ls -la src/renderer/fonts/
```

Expected: six `.woff2` files. They are **committed to the repo**, not resolved from `node_modules` at
runtime — `electron-builder.yml`'s `files:` glob packs `src/**/*`, and a renderer loading fonts from
`node_modules` would break in a packaged build.

Verify the filenames actually exist before copying; `@fontsource` package layouts change between
major versions.

- [ ] **Step 2: Write `fonts.css`**

```css
/* src/renderer/styles/fonts.css
   Self-hosted so the app works offline and inside a packaged asar. */
@font-face { font-family: 'Rajdhani'; font-style: normal; font-weight: 400;
  src: url('../fonts/rajdhani-latin-400-normal.woff2') format('woff2'); font-display: swap; }
@font-face { font-family: 'Rajdhani'; font-style: normal; font-weight: 500;
  src: url('../fonts/rajdhani-latin-500-normal.woff2') format('woff2'); font-display: swap; }
@font-face { font-family: 'Rajdhani'; font-style: normal; font-weight: 600;
  src: url('../fonts/rajdhani-latin-600-normal.woff2') format('woff2'); font-display: swap; }
@font-face { font-family: 'Rajdhani'; font-style: normal; font-weight: 700;
  src: url('../fonts/rajdhani-latin-700-normal.woff2') format('woff2'); font-display: swap; }
@font-face { font-family: 'Space Mono'; font-style: normal; font-weight: 400;
  src: url('../fonts/space-mono-latin-400-normal.woff2') format('woff2'); font-display: swap; }
@font-face { font-family: 'Space Mono'; font-style: normal; font-weight: 700;
  src: url('../fonts/space-mono-latin-700-normal.woff2') format('woff2'); font-display: swap; }
```

- [ ] **Step 3: Link it first in `<head>`**

Before the `tokens.css` link:

```html
<link rel="stylesheet" href="styles/fonts.css">
```

- [ ] **Step 4: Verify the fonts actually load**

Launch the app (PowerShell pattern from Task 1 Step 7). Open DevTools with `Ctrl+Shift+I`, and in the
console:

```js
document.fonts.check('700 12px Rajdhani')      // expect true
document.fonts.check('400 12px "Space Mono"')  // expect true
```

`false` means the `@font-face` src path is wrong relative to `styles/`. The Network tab will show the
404. **Do not accept "it looks different" as proof the fonts loaded** — the fallback chain
(Bahnschrift, Segoe UI) also changes the look, which is exactly how a font 404 hides.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/fonts src/renderer/styles/fonts.css src/renderer/index.html package.json package-lock.json
git commit -m "feat(reskin): self-host Rajdhani and Space Mono

Six woff2 files committed under src/renderer/fonts/ rather than resolved
from node_modules, because electron-builder packs src/**/* and a renderer
loading fonts out of node_modules breaks in a packaged build.

Rajdhani for labels, Space Mono for numbers. That split carries more of
the Aether look than any gradient does. Verified with document.fonts.check
rather than by eye - the Bahnschrift/Segoe fallback also changes the
look, which is how a font 404 hides."
```

---

### Task 4: Close the three palette escapes

**Files:**
- Modify: `src/renderer/dashboard/dashboard.css`, `src/renderer/index.html`,
  `src/renderer/terminal/terminal.js`
- Create: `test/paletteEscapes.test.js`

Three hardcoded colours bypass the palette system entirely and would survive the whole reskin
looking subtly wrong in eighteen of nineteen palettes.

- [ ] **Step 1: Write the failing guard**

```js
// test/paletteEscapes.test.js
// Colours hardcoded outside the palette system look correct in exactly one
// palette and wrong in the other eighteen, which is why they survive review.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'src', 'renderer');
const FILES = ['dashboard/dashboard.css', 'index.html', 'terminal/terminal.js',
               'fleet/fleet.css', 'dashboard/dashboard.js'];
// tokens.css legitimately contains hex values - it is the palette definition.
const HEX = /#[0-9a-fA-F]{6}\b/g;

test('no hardcoded hex colours outside tokens.css', () => {
  const hits = [];
  for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const found = fs.readFileSync(p, 'utf8').match(HEX);
    if (found) hits.push(`${rel}: ${[...new Set(found)].join(', ')}`);
  }
  assert.deepStrictEqual(hits, [], `hardcoded colours found:\n${hits.join('\n')}`);
});
```

- [ ] **Step 2: Run it — expect failures naming all three**

```bash
node --test test/paletteEscapes.test.js
```

Expected FAIL listing at least `#ff6b6b` (dashboard.css), `#0b0e14` (index.html) and
`#0b0e14`/`#e7ebf3` (terminal.js).

- [ ] **Step 3: Fix each**

- `dashboard.css:58`, `:133`, `:385` — replace `#ff6b6b` with `var(--danger)`.
- `index.html:10` — delete `background:#0b0e14` from the `<body>` inline style. `tokens.css` already
  sets the page background via `--bg-base`; add `body { background: var(--bg-base); }` to
  `dashboard.css` if it is not already covered.
- `terminal.js:13` — the xterm constructor hardcodes `background:'#0b0e14', foreground:'#e7ebf3'`.
  `applyTerminalTheme()` at `:80-87` already reads computed custom properties, so the fix is to build
  the initial theme the same way rather than from literals. Read `--bg-term` and `--tx-primary`.

- [ ] **Step 4: Verify in the app across two palettes**

Launch, and switch between a light and a dark palette. The terminal background and any error text
must both follow. Previously the terminal stayed dark in every palette.

- [ ] **Step 5: Run the suite and commit**

```bash
npm test
git add -A
git commit -m "fix(reskin): close the three palette escapes

#ff6b6b (dashboard.css:58,133,385), the #0b0e14 inline body background
(index.html:10) and xterm's hardcoded constructor colours
(terminal.js:13) all bypassed the palette system. Each looks correct in
exactly one palette and wrong in the other eighteen, which is why they
survived this long.

test/paletteEscapes.test.js fails if a hex literal reappears outside
tokens.css."
```

---

### Task 5: Persist palette, mode and language

**Files:**
- Modify: `src/shared/themeConfig.js`, `test/themeConfig.test.js`

**This task is where Trap 1 lives.** Read the "two traps" section above before starting.

- [ ] **Step 1: Write the failing round-trip test**

Add to `test/themeConfig.test.js`. Check its existing `require` block first — these cases use
`fsp` (`node:fs/promises`), `path`, `os` and `DEFAULT_THEME`, and the file may not import all four
today. Add whichever are missing rather than assuming.

```js
test('save then load round-trips all three axes', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tm-theme-'));
  const p = path.join(dir, 'theme.json');
  await saveThemeConfig(p, { theme: 'violet', mode: 'light', lang: 'aether' });
  const back = await loadThemeConfig(p);
  assert.strictEqual(back.theme, 'violet');
  assert.strictEqual(back.mode, 'light');   // fails today: saveThemeConfig drops it
  assert.strictEqual(back.lang, 'aether');  // fails today: saveThemeConfig drops it
});

test('a legacy palette forces flat language regardless of what was saved', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tm-theme-'));
  const p = path.join(dir, 'theme.json');
  await saveThemeConfig(p, { theme: 'midnight', mode: 'dark', lang: 'aether' });
  assert.strictEqual((await loadThemeConfig(p)).lang, 'flat');
});

test('a user on the cut tokyonight palette falls back cleanly', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tm-theme-'));
  const p = path.join(dir, 'theme.json');
  await fsp.writeFile(p, JSON.stringify({ theme: 'tokyonight' }));
  const back = await loadThemeConfig(p);
  assert.strictEqual(back.theme, DEFAULT_THEME);
});
```

- [ ] **Step 2: Run and confirm the drop**

```bash
node --test test/themeConfig.test.js
```

Expected: the round-trip test **FAILS** on `mode` being `undefined`. That failure is Trap 1 made
visible — `saveThemeConfig:44` writes `JSON.stringify({ theme: validated })` and discards everything
else. Confirm you see exactly that before fixing it.

- [ ] **Step 3: Rewrite `themeConfig.js`**

- `KNOWN_PALETTES` becomes the 19: the five Aether slugs plus the nine legacy. Remove `tokyonight`.
- Add `AETHER_PALETTES` and `KNOWN_MODES = ['dark','light']`.
- `lang` is **derived, not stored independently**: a legacy palette is always `flat`, an Aether
  palette is always `aether`. Deriving it removes a whole class of inconsistent state.
- `DEFAULT_THEME` becomes `'steel'`, default mode `'dark'` (spec section 2).
- `loadThemeConfig` returns `{ theme, mode, lang }`, each validated with a fallback.
- **`saveThemeConfig` must persist `theme` and `mode`.** This is the actual fix.

- [ ] **Step 4: Tests pass, then commit**

```bash
npm test
git add src/shared/themeConfig.js test/themeConfig.test.js
git commit -m "feat(reskin): persist palette and light/dark mode

KNOWN_PALETTES grows to nineteen; tokyonight is removed and users on it
fall back to the default rather than erroring. Default becomes steel/dark.

The real fix is in saveThemeConfig, which wrote JSON.stringify({ theme })
and silently discarded every other key. A mode toggle built on it would
have appeared to work and then reverted on restart, with no error
anywhere. The round-trip test is what makes that visible.

lang is derived from the palette rather than stored, so aether and flat
can never disagree with the palette they describe."
```

---

### Task 6: Palette and mode controls in Settings

**Files:**
- Modify: `src/renderer/dashboard/panels/settingsPanel.js`, `src/main/ipcHandlers.js`

- [ ] **Step 1: Rebuild the swatch grid for nineteen palettes**

`settingsPanel.js:11-22` re-declares each palette's `--bg` and `--acc` as JS literals to paint the
swatch chips, with a comment admitting CSS is the source of truth. **Do not extend that list to
nineteen.** Read the values at runtime instead:

```js
// Read each palette's swatch colours from the CSS itself, so the grid can never
// disagree with tokens.css. Call ONCE at mount and cache - see the note below.
function readSwatches(slugs) {
  const root = document.documentElement;
  const prevPal = root.getAttribute('data-pal');
  const prevMode = root.getAttribute('data-mode');
  const out = {};
  for (const slug of slugs) {
    root.setAttribute('data-pal', slug);
    const cs = getComputedStyle(root);
    out[slug] = { bg: cs.getPropertyValue('--bg-base').trim(),
                  acc: cs.getPropertyValue('--acc').trim() };
  }
  // Restore before returning, or the app is left wearing the last palette read.
  if (prevPal) root.setAttribute('data-pal', prevPal); else root.removeAttribute('data-pal');
  if (prevMode) root.setAttribute('data-mode', prevMode); else root.removeAttribute('data-mode');
  return out;
}
```

**The attribute must go on `document.documentElement`, not a probe element.** The selectors in
`tokens.css` are `html[data-pal="..."]`, so they match only the root element — a detached `<div>`
carrying `data-pal` matches nothing and every value comes back empty. That failure is quiet: the
swatches render, just colourless.

Reading in a loop is safe despite mutating the live root: the browser does not paint mid-task, so no
flicker is possible, and the attributes are restored before the function returns. Call it once at
mount and cache the result — do not call it per render.

This deletes the duplication rather than doubling it — the same drift problem `packages/core` exists
to solve, in CSS form.

- [ ] **Step 1a: Prove the swatches are real**

With the app running, in DevTools console:

```js
document.querySelectorAll('.swatch-btn').length   // expect 19
```

and confirm no swatch is transparent or black-on-black. An empty `--bg-base` renders as a
transparent chip that looks plausible against a dark panel, so count and inspect rather than glance.

- [ ] **Step 2: Add the light/dark segmented control**

Under Appearance, next to the swatch grid. Setting it writes `data-mode` on `document.documentElement`
and persists via the existing theme IPC channel, extended to carry `mode`.

- [ ] **Step 3: Verify persistence across a restart**

Set violet + light, close the app **completely**, relaunch. Both must survive. This is the check that
would have caught Trap 1 had Task 5's test not.

- [ ] **Step 4: Commit**

---

### Task 7: The chrome pass

**Files:**
- Modify: `src/renderer/index.html`, `src/renderer/dashboard/dashboard.css`

- [ ] **Step 1: Restyle the header as the prototype's titlebar**

From `docs/prototype/index.html:241-244`:

```css
.titlebar {
  flex: none; display: flex; align-items: center; gap: 14px;
  padding: 0 16px; height: 48px;
  background: var(--chrome-bg);
  border-bottom: 1px solid var(--chrome-bd);
  backdrop-filter: blur(6px);
}
```

The window stays natively framed — spec section 8. This styles the in-app `<header>`, nothing more.
Add `Menu.setApplicationMenu(null)` in `src/main/main.js` to drop the default Electron menu bar.

- [ ] **Step 2: Add the footer status strip**

From the prototype at `:480`:

```css
.footer {
  flex: none; display: flex; align-items: center; gap: 14px;
  padding: 0 16px; height: 34px;
  background: var(--chrome-bg); border-top: 1px solid var(--chrome-bd);
  font: 400 9.5px/1 var(--f-mono); color: var(--tx-dim);
}
```

Contents: version chip, fleet share path, seat count, alarm state. The version chip reads the same
value `#settings-version` already renders.

- [ ] **Step 3: Adopt the panel formula**

The prototype's `.panel` (`:339-342`) is:

```css
background: var(--panel-grad); border: 1px solid var(--panel-bd);
border-radius: var(--r-panel); padding: 15px 17px;
box-shadow: 0 1px 0 var(--acc-wash) inset, 0 10px 30px rgba(0,0,0,.28);
```

**`padding: 15px 17px` is already v1's panel padding**, so only the background, border-radius and
box-shadow change. Apply to `.hero-tile`, `.budget-panel`, `.agents-panel`, `.task-panel`,
`.optimize-panel`, `.treemap-panel`, `.insights-card` and `.optimize-card`.

- [ ] **Step 4: Verify across three palettes and both modes, then commit**

---

### Task 8: Extract the header and layout inline styles

**Files:**
- Modify: `src/renderer/index.html`, `src/renderer/dashboard/dashboard.css`
- Create: `test/inlineStyles.test.js`

**This is the largest mechanical cost in the reskin and the reason a CSS-only approach is impossible.**
`index.html` carries 40 `style=` attributes covering the header, both segmented controls, the settings
popover and the top-level flex layout. Inline styles override stylesheets, so any rule targeting those
surfaces silently does nothing until they are gone.

- [ ] **Step 1: Write a budget test, not a ban**

A hard ban would fail on the panels Phase 5 has not reached yet. Assert a **decreasing ceiling**
instead:

```js
// test/inlineStyles.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Ratchet: lower this number as Phase 5 slices land. Never raise it.
const MAX_INLINE_STYLES = 12;

test('index.html inline style budget', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  const n = (html.match(/\sstyle="/g) || []).length;
  assert.ok(n <= MAX_INLINE_STYLES,
    `${n} inline style attributes, budget is ${MAX_INLINE_STYLES}. ` +
    `Extract to dashboard.css rather than raising the budget.`);
});
```

- [ ] **Step 2: Run it — expect ~40 against a budget of 12**

- [ ] **Step 3: Extract, grouped by surface**

Header and tools → `.hdr`, `.hdr-tools`. Both segmented controls → `.seg`. Settings popover →
`.settings-popover` and children. Top-level layout (`<body>`, `#content-row`, `#terminal-pane`,
`#pane-divider`, `#dashboard-pane`) → real classes.

Keep `style=` only where a value is genuinely computed at runtime (bar widths, pane width from
`cliWidth`). Those are data, not styling, and belong inline.

- [ ] **Step 4: Verify nothing moved**

Compare against a screenshot taken before this task. Layout must be **identical** — this task changes
where styles live, not what they say. Check the terminal/dashboard divider still drags and the
settings popover still positions correctly; both were inline-positioned.

- [ ] **Step 5: Commit**

---

## Definition of done

- `npm test` green, including `tokens`, `contrast`, `paletteEscapes` and `inlineStyles`.
- The app launches on Steel/dark with Rajdhani labels and Space Mono numerals.
- All 19 palettes selectable; light/dark toggles; both survive a full restart.
- Every legacy palette passes its WCAG floors, or is documented as cut with its measured ratios.
- No hex literal outside `tokens.css`.
- `index.html` inline `style=` count at or below 12.
- Panel markup unchanged — no `TT.*.render()` template touched.

## What this plan deliberately does not do

- **No panel markup.** Phase 5, ten slices, its own plan.
- **No instruments.** Reactor / Arc / Tach-V / Tach-H are new components, separate spec.
- **No frameless window.** Spec section 8 keeps native chrome.
- **Does not delete the compatibility aliases.** They go in Phase 5's final slice, once no rule
  references them.
