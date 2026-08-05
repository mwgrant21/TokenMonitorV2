// src/shared/shortcutMap.js
// Key -> action map for the dashboard. Later phases add view:* and mini:toggle here;
// the renderer dispatcher stays generic.
const KEYMAP = {
  '1': 'period:today',
  '2': 'period:7d',
  '3': 'period:30d',
  '4': 'period:month',
  i: 'insights:toggle',
  e: 'export:open',
  p: 'view:personal',
  t: 'view:team',
  m: 'mini:toggle',
  ',': 'settings:toggle',
  '?': 'help:toggle',
  Escape: 'overlay:close',
};

function resolveShortcut(key, ctx) {
  const c = ctx || {};
  if (c.typing || c.onboardingOpen || c.modifier) return null;
  return KEYMAP[key] || null;
}

module.exports = { KEYMAP, resolveShortcut };
