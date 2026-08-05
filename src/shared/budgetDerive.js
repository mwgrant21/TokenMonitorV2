const DEFAULT_MONTHLY_TOKENS = 120_000_000;

// Onboarding asks only for a monthly token budget; the narrower windows are
// derived: week = month/4, day = month/30, session = day/3 (~3 sessions/day).
function deriveBudgetsFromMonthly(monthlyTokens) {
  const valid = typeof monthlyTokens === 'number' && Number.isFinite(monthlyTokens) && monthlyTokens >= 1;
  const month = valid ? Math.round(monthlyTokens) : DEFAULT_MONTHLY_TOKENS;
  const week = Math.max(1, Math.round(month / 4));
  const day = Math.max(1, Math.round(month / 30));
  const session = Math.max(1, Math.round(day / 3));
  return { month: { tokens: month }, week: { tokens: week }, day: { tokens: day }, session: { tokens: session } };
}

module.exports = { deriveBudgetsFromMonthly, DEFAULT_MONTHLY_TOKENS };
