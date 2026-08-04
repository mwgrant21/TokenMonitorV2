# @tokenmonitor/core

Pure, dependency-free Claude Code usage logic shared by **TokenMonitor** and **Aether OS**.
No `fs`, no Electron, no network, no model calls.

Both repos previously kept their own copy of every module in here. The copies had
already diverged — see "Divergences resolved" below. That drift is the reason this
package exists; the visual convergence work is a separate concern.

## Build

```
npm run build     # tsc -> dist/esm (ESM + .d.ts), then a mechanical transform -> dist/cjs
npm test          # build, then run TokenMonitor's original suites against dist/cjs
```

TypeScript source, dual output:

- **Aether OS** (ESM/TS) imports `dist/esm` via the `exports` map, with full types.
- **TokenMonitor** (CommonJS, no bundler) `require`s `dist/cjs/*.cjs`.

`build.mjs` does the CJS transform itself rather than pulling in a bundler. That is
only safe because this package is pure logic with no dependencies and no dynamic
imports — if either stops being true, replace it with tsup/esbuild.

## Divergences resolved

Two real behavioural differences were found between the copies. Both suites were
green; each only ever exercised its own shape. This is the same failure mode as the
`usageTokens()` cache-token bug documented in Aether's README.

**1 · `eventTimestampMs` — Aether's version would have thrown on TokenMonitor's data.**

```
Aether:       e.timestamp ? e.timestamp.getTime() : NaN     // assumes Date
TokenMonitor: coerces strings, guards a null event
```

TokenMonitor reads timestamps straight out of JSONL, where they are **strings**.
Adopting Aether's version would have silently broken `evaluateOptimizeRulesWithRecurrence`
— the verify half of the optimize loop — on every real TokenMonitor transcript.
Core keeps TokenMonitor's defensive version. See `types.ts`; do not "simplify" it.

**2 · `findUncappedBashOutput` read two different fields.**

```
Aether:       result.resultLength    // per tool-result -- semantically correct
TokenMonitor: e._rawResultLength     // per EVENT -- double-counts multi-result events
```

Core prefers the per-result field and falls back to the legacy event-level one so
TokenMonitor keeps working unchanged. Remove the fallback once TokenMonitor's
`transcriptParser` emits `resultLength` per tool result.

## What each app gains

- **TokenMonitor** gains the `cost-of-thrash` rule (a 4th optimize finding) it did not have.
- **Aether OS** gains the defensive timestamp handling and the `RULES_BY_ID` export.

## Owned here

`TranscriptEvent` lives in `types.ts`. Aether previously imported it from
`electron/transcriptParser`, coupling pure logic to the Electron main process and
making the module unusable from a renderer. Neither app owns the type now; both
structurally satisfy it.
