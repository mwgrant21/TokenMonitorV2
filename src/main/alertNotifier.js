// src/main/alertNotifier.js
// Pure diff of "which alerts just started firing" for OS notifications.
// Kept free of Electron imports so node --test reaches it; main.js owns
// the actual Notification calls.

function pickNewAlerts(prevIds, alerts) {
  const list = alerts || [];
  const newAlerts = list.filter((a) => !prevIds.has(a.id));
  const nextIds = new Set(list.map((a) => a.id));
  return { newAlerts, nextIds };
}

module.exports = { pickNewAlerts };
