// src/shared/alertEngine.js
// Pure alert evaluation over dashboard-state inputs. No DOM, no Electron.
// The renderer banner, CLI toast, and main-process OS notifications all
// consume the alert objects produced here.

const BASELINE_FLOOR_TPM = 50; // tokens/min; below this the baseline is idle noise
const BUDGET_WINDOW_ORDER = ['session', 'day', 'week', 'month'];

function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function budgetAlerts(config, budgetVsQuota) {
  const alerts = [];
  for (const window of BUDGET_WINDOW_ORDER) {
    const entry = budgetVsQuota && budgetVsQuota[window];
    if (!entry || !(entry.limit > 0)) continue;
    const pct = (entry.used / entry.limit) * 100;
    if (pct < config.thBudget) continue;
    const rounded = Math.round(pct);
    alerts.push({
      id: `budget-${window}`,
      severity: pct >= 100 ? 'critical' : 'warning',
      title: `${window[0].toUpperCase()}${window.slice(1)} budget at ${rounded}%`,
      detail: `${fmtTokens(entry.used)} of ${fmtTokens(entry.limit)} tokens used`,
      why: `You have used ${rounded}% of your ${window} token budget.`,
      fix: `Trim context in long sessions or raise the ${window} budget in Settings.`,
      chips: [{ kind: 'copy', label: '/compact session', text: '/compact' }],
    });
  }
  return alerts;
}

function burnAlert(config, burnNow, burnBaseline) {
  if (!(burnBaseline >= BASELINE_FLOOR_TPM)) return [];
  const ratio = burnNow / burnBaseline;
  if (ratio < config.thBurn) return [];
  return [{
    id: 'burn-spike',
    severity: ratio >= 2 * config.thBurn ? 'critical' : 'warning',
    title: `Burn rate ${ratio.toFixed(1)}x your baseline`,
    detail: `${Math.round(burnNow)} tok/min vs ${Math.round(burnBaseline)} baseline`,
    why: `Recent burn is ${ratio.toFixed(1)}x the last hour's baseline - something is consuming tokens much faster than normal.`,
    fix: 'Check running agents and switch trivial turns to a smaller model.',
    chips: [{ kind: 'copy', label: 'switch model to Sonnet', text: '/model sonnet' }],
  }];
}

function wasteAlert(config, optimizeFindings) {
  const findings = (optimizeFindings || []).filter((f) => f && Number.isFinite(f.estSavingsPerWeek));
  const total = findings.reduce((sum, f) => sum + f.estSavingsPerWeek, 0);
  if (total < config.thWaste) return [];
  return [{
    id: 'waste-threshold',
    severity: 'critical',
    title: `$${Math.round(total)}/wk wasted - reclaimable`,
    detail: `${findings.length} optimize finding(s) - apply fixes to reclaim`,
    why: `Optimize found ~$${Math.round(total)}/wk of reclaimable spend across ${findings.length} finding(s).`,
    fix: 'Apply the Optimize fixes below - each writes a guidance line to CLAUDE.md.',
    chips: findings.map((f) => ({ kind: 'apply', label: `fix: ${f.title}`, findingId: f.id, title: f.title })),
  }];
}

function agentAlerts(config, runningAgents) {
  const ceiling = config.thAgent * 1000;
  return (runningAgents || [])
    .filter((agent) => agent && agent.tokens >= ceiling)
    .sort((a, b) => b.tokens - a.tokens)
    .map((agent) => ({
      id: `agent-ceiling-${agent.id}`,
      severity: 'critical',
      title: `${agent.subagentType || 'agent'} over token ceiling`,
      detail: `${fmtTokens(agent.tokens)} tokens - still running`,
      why: `This agent has consumed ~${fmtTokens(agent.tokens)} tokens since it started (ceiling: ${config.thAgent}k).`,
      fix: "Scope the agent's task tighter or cap its output size.",
      chips: [{ kind: 'copy', label: 'set agent cap', text: 'Keep subagent output small: return a concise summary, not raw file dumps.' }],
    }));
}

function planAlerts(config, planUsage, planWarnings) {
  const alerts = [];
  if (planUsage && planUsage.week && Number.isFinite(planUsage.week.pct) && planUsage.week.pct >= config.thBudget) {
    const pct = Math.round(planUsage.week.pct);
    alerts.push({
      id: 'plan-week',
      severity: planUsage.week.pct >= 100 ? 'critical' : 'warning',
      title: `Plan weekly usage at ${pct}%`,
      detail: `resets ${planUsage.week.resetsAt}`,
      why: `Your flat-rate plan's weekly limit is ${pct}% consumed (as of the last /usage sync).`,
      fix: 'Shift heavy work to after the reset, or route trivial turns to a smaller model.',
      chips: [{ kind: 'copy', label: 'switch model to Sonnet', text: '/model sonnet' }],
    });
  }
  for (const w of planWarnings || []) {
    alerts.push({
      id: 'plan-limit-hit',
      severity: 'critical',
      title: 'Plan limit reached',
      detail: w.resetsAt ? `resets ${w.resetsAt}` : w.message,
      why: `Claude Code reported: "${w.message}"`,
      fix: 'Wait for the reset, or continue on a lighter model if available.',
      chips: [],
    });
  }
  return alerts;
}

// evaluateAlerts(inputs) -> alert[] sorted criticals-first; within a severity:
// budget windows in BUDGET_WINDOW_ORDER, then burn, then waste, then agents
// (agents pre-sorted by tokens desc).
function evaluateAlerts({ config, budgetVsQuota, burnNow, burnBaseline, optimizeFindings, runningAgents, planUsage, planWarnings }) {
  if (!config || config.enabled === false) return [];
  const ordered = [
    ...budgetAlerts(config, budgetVsQuota),
    ...burnAlert(config, burnNow || 0, burnBaseline || 0),
    ...wasteAlert(config, optimizeFindings),
    ...agentAlerts(config, runningAgents),
    ...planAlerts(config, planUsage, planWarnings),
  ];
  const criticals = ordered.filter((a) => a.severity === 'critical');
  const warnings = ordered.filter((a) => a.severity === 'warning');
  return [...criticals, ...warnings];
}

module.exports = { evaluateAlerts, BASELINE_FLOOR_TPM, BUDGET_WINDOW_ORDER };
