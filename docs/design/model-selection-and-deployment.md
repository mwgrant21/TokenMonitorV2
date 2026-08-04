# Model selection, thinking effort, and department deployment

Researched against current Claude Code docs (`code.claude.com/docs`), not from memory — several of
these mechanisms changed recently and at least one thing you probably still believe is now false.

---

## 1 · The headline: your "Auto" already exists

You said the default should be *"my automatic — only uses the best possible model for the given
context."* **Claude Code ships that.** You don't need to build it, and — this matters — you
*couldn't* build a better one without breaking your own rule.

### `opusplan`

A model alias that uses **Opus during plan mode, then automatically switches to Sonnet for
execution.** Deep reasoning where the thinking happens, cheap execution where it's just typing code.
That is precisely "best model for the context," it's deterministic, it's free, and it costs zero API
calls to decide — because the switch is driven by Claude Code's own mode state, not by anything
inspecting your prompt.

Related aliases, for completeness: `default` (clears override, falls back to account/org default),
`best` (Fable 5 where available, else latest Opus), `sonnet`, `opus`, `haiku`, `fable`, plus
`sonnet[1m]` / `opus[1m]` / `opusplan[1m]` for the 1M-token context variants, and full model IDs.

### `CLAUDE_CODE_EFFORT_LEVEL=auto`

Effort has its own automatic setting. Levels are `low` / `medium` / `high` / `xhigh` / `max`
(model-dependent — Opus 4.6 and Sonnet 4.6 have no `xhigh`), and `auto` is a real accepted value for
the env var.

**So "Auto / Optimized" in TokenMonitor = `ANTHROPIC_MODEL=opusplan` + `CLAUDE_CODE_EFFORT_LEVEL=auto`.**
Two environment variables. No router, no classifier, no custom logic to maintain.

### Why you must not build your own

An automatic model router that reads the task and picks a model has to *understand the task* — which
means a model call on every turn. **That is exactly the API burn you ruled out**, and it would burn
it on the meta-work rather than the actual work. Any local heuristic you'd write instead (keyword
matching, file-count thresholds) would be worse than `opusplan`, which has actual mode state to
switch on. Ship the built-in. This is the rare case where the right answer is less code.

---

## 2 · Things that have changed since you last looked

Two corrections worth internalising, because they affect how you'll teach this:

**"think" / "think hard" / "think harder" are no longer magic keywords.** They are passed through as
ordinary prompt text and do nothing. **Only `ultrathink` is still recognised** — and even then it
adds an in-context instruction for that turn without changing the session's effort level. If you
teach the old escalation ladder to your department, you'll be teaching a superstition. The real
control is `/effort`.

**Effort is now a first-class, persistent setting** with its own command and slider:

| Mechanism | Persistence |
|---|---|
| `/effort <level>` | saves for future sessions (except `max` / `ultracode`, session-only) |
| `claude --effort <level>` | session only |
| `effortLevel` in settings.json | persistent (`low`/`medium`/`high`/`xhigh` only) |
| `CLAUDE_CODE_EFFORT_LEVEL` env var | **highest priority**, overrides everything, accepts `auto` |
| skill / subagent frontmatter `effort:` | overrides session, but not the env var |

Also: `Alt+T` toggles extended thinking for the session; `/config` → "thinking mode" persists it as
`alwaysThinkingEnabled`. `ultracode` is `xhigh` **plus** dynamic workflow orchestration — session-only,
and worth knowing about but almost certainly not what you want as a department default.

---

## 3 · How TokenMonitor sets it

You chose: **session by default, explicit pin to persist.** Both paths are supported.

### Session (default)

`ptyManager.js#spawnPty()` spawns PowerShell and writes `claude\r`. Pass the env on that spawn:

```js
// src/main/ptyManager.js
const env = { ...process.env };
if (model)  env.ANTHROPIC_MODEL = model;            // 'opusplan' for Auto
if (effort) env.CLAUDE_CODE_EFFORT_LEVEL = effort;  // 'auto' for Auto
```

Env vars take precedence over settings files, so this cleanly overrides whatever the user has
configured globally, for this terminal only, without writing a single file. Nothing to corrupt,
nothing to clean up.

### Pin (opt-in)

Writes `model` and `effortLevel` into `~/.claude/settings.json`. Treat this with the **same care as
the Optimize CLAUDE.md writes** — read, merge, preserve everything else byte for byte, write atomically
via temp-file-and-rename. This is a file Claude Code owns and a corrupted settings.json is a
support ticket on someone else's machine.

### Changing mid-session

`model` is **read once at session start** and does not reload. The only in-session change is typing
`/model <alias>` or `/effort <level>` into the TUI.

**You already have this machinery.** `usageScraper.js` drives `/usage` into the pty and parses the TUI
with quiescence polling. Same trick, simpler parse. Two cautions carried over from that code:

- The quiescence-poll lesson applies — don't send and immediately assume; wait for the frame to settle.
- Typing into a user's live terminal while they're mid-prompt is rude and possibly destructive. Gate
  it: only inject when the pty is idle, otherwise show *"applies to your next session"* and set the
  env for the next spawn. **Safe-by-default, same posture you asked for after the $25 incident.**

### Precedence (highest → lowest)

Managed settings → CLI flags → `.claude/settings.local.json` → `.claude/settings.json` →
`~/.claude/settings.json`, with `ANTHROPIC_MODEL` above the settings files but below CLI flags.

---

## 4 · Guidance, not enforcement — as chosen

You picked guidance. Recorded for completeness: the enforcement lever exists if you ever change your
mind. `availableModels` + `enforceAvailableModels` in Windows managed settings
(`HKLM\SOFTWARE\Policies\ClaudeCode` via Group Policy, or
`C:\Program Files\ClaudeCode\managed-settings.json`) can remove Opus from the picker org-wide,
unoverridable by users. **Not doing this.**

The guidance version is already the more TokenMonitor-native answer anyway: the picker shows a live
cost delta computed from that person's own last 7 days —
*"Auto would have cost ~$31 vs ~$52 on Opus throughout."* That number is local, free, and personal,
which makes it far more persuasive than a policy block. It also pairs directly with the existing
`opus-on-trivial-turns` optimize rule: the rule finds the waste, the picker offers the fix, and the
verify step confirms it held.

---

## 5 · Packaging your skills and agents for the department

A **plugin** is the right container, and a **marketplace** is how it reaches people.

### Plugin layout

```
tokenmonitor-toolkit/
├── .claude-plugin/
│   └── plugin.json          # name (kebab-case, required), version, description
├── skills/
│   └── <skill-name>/SKILL.md
├── agents/
│   └── <agent-name>.md      # can pin `model:` and `effort:` in frontmatter
├── hooks/hooks.json
└── .mcp.json
```

Notes that will save you time:

- Components live at the plugin **root**, not inside `.claude-plugin/`.
- `plugin.json` is optional unless you need custom component paths.
- **Omit `version` and the git commit SHA becomes the version** — every commit is a new version, no
  manual bumping. Given §9 of the other doc, that's tempting; I'd still set an explicit version so
  a coworker can read you a number rather than a SHA.
- Skills get namespaced as `/plugin-name:skill-name`.
- **Per-agent model and effort pinning is the sharpest tool here.** A reviewer agent can pin
  `model: sonnet` / `effort: low`; a planning agent can pin `model: opus`. That gives you the routing
  you wanted at the *agent* level, declaratively, with no runtime decision and no API cost.

### Marketplace — and it can live on your existing share

`.claude-plugin/marketplace.json` lists plugins and their sources. It can be hosted on a **git repo
(including private/self-hosted), a plain local path, or a URL.** A local path means **the network
share you already use for fleet reports can host it** — no GitHub, no external dependency:

```
/plugin marketplace add \\shared\claude-usage\plugins
/plugin install tokenmonitor-toolkit@infra-tools
```

Non-interactive, for a deployment script:

```
claude plugin install tokenmonitor-toolkit@infra-tools --scope project
```

### Onboarding without asking anyone to type anything

Put this in the **project** `.claude/settings.json` and commit it. When someone trusts the folder,
Claude Code prompts to install (v2.1.195+):

```json
{
  "extraKnownMarketplaces": {
    "infra-tools": { "source": { "source": "url", "url": "..." } }
  },
  "enabledPlugins": { "tokenmonitor-toolkit@infra-tools": true },
  "model": "opusplan",
  "effortLevel": "high"
}
```

That single file gives a brand-new person your skills, your agents, and Auto-by-default the first
time they open the repo. **This is your "hit the ground running."**

### One limitation to plan around

Plugins **cannot ship general settings.** A plugin's own `settings.json` supports only `agent` and
`subagentStatusLine`; every other key is silently dropped. So `model`, `effortLevel`, permissions and
env must be deployed via **project `.claude/settings.json`** (committed, as above) or managed
settings. Don't waste an afternoon discovering this the way the `uiConfig.js` whitelist teaches the
same lesson.

---

## 6 · Suggested order

1. Add `model` / `effort` params to `spawnPty()` and set the two env vars — Auto by default
2. Picker UI in the terminal folder bar (built in the v2 prototype) + mirror in Settings
3. Compute the cost-delta hint from existing `historyAggregator` data — no new plumbing
4. Pin-to-settings.json, with the atomic read-merge-write treatment
5. `/model` and `/effort` injection for mid-session changes, **idle-gated**
6. Build the plugin: skills, agents, per-agent `model:`/`effort:` pins
7. Marketplace on the share + committed project `.claude/settings.json` for onboarding
8. Write the one-page "what these settings mean" doc for the team — steps 1–7 are worthless if the
   first thing someone does is switch to Opus because it sounds better
