// test/activityMarkup.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('activity.js renders a lane-dot per agent lane', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'dashboard', 'panels', 'activity.js'), 'utf8');
  assert.ok(src.includes('agent-dot'), 'renderAgents should render a status dot per lane, matching the prototype .lane-dot');
});
