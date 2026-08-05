const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { cwdToProjectDirName, projectDirForCwd } = require('../src/main/sessionPaths');

test('sanitizes a Windows cwd path the same way Claude Code does', () => {
  assert.equal(cwdToProjectDirName('C:\\Users\\IT\\.claude'), 'C--Users-IT--claude');
});

test('projectDirForCwd joins the sanitized name under <home>/.claude/projects', () => {
  const result = projectDirForCwd('C:\\Users\\IT\\.claude', 'C:\\Users\\IT');
  assert.equal(result, path.join('C:\\Users\\IT', '.claude', 'projects', 'C--Users-IT--claude'));
});
