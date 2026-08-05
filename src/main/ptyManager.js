// src/main/ptyManager.js
const pty = require('node-pty');
const os = require('node:os');

// The terminal pane ALWAYS starts a fresh claude session. Never add resume
// flags (--continue/--resume/-c/-r) here: staff first-run must not open on a
// stale session or someone else's pending approval prompt (design v2 decision).
const CLAUDE_LAUNCH_COMMAND = 'claude\r';

function spawnPty({ cwd, cols = 100, rows = 30, shellOverride, autoLaunchClaude = true, ptyLib = pty } = {}) {
  const shell = shellOverride || (process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash');
  const ptyProcess = ptyLib.spawn(shell, [], {
    name: 'xterm-color',
    cols,
    rows,
    cwd: cwd || os.homedir(),
    env: process.env,
  });
  if (autoLaunchClaude) {
    ptyProcess.write(CLAUDE_LAUNCH_COMMAND);
  }
  return ptyProcess;
}

module.exports = { spawnPty, CLAUDE_LAUNCH_COMMAND };
