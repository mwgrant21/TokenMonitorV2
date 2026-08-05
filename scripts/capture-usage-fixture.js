// scripts/capture-usage-fixture.js
// One-shot: spawn claude in a pty, open /usage, record the cleaned output.
// Usage: node scripts/capture-usage-fixture.js
const pty = require('node-pty');
const fs = require('node:fs');
const path = require('node:path');

// Minimal inline ANSI strip (Task 2 ships the real shared module).
function stripAnsi(s) {
  return s
    .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
// Use an already-trusted directory so claude doesn't block on the first-run
// trust dialog (which would swallow the /usage keystrokes instead of claude).
const cwd = process.platform === 'win32'
  ? path.join(require('node:os').homedir(), '.local', 'bin')
  : require('node:os').homedir();
const p = pty.spawn(shell, [], { cols: 120, rows: 40, cwd, env: process.env });
let raw = '';
p.onData((d) => { raw += d; });

setTimeout(() => p.write('claude\r'), 1000);
setTimeout(() => p.write('/usage\r'), 15000);      // let claude boot first
setTimeout(() => p.write('\x1b'), 27000);        // Esc closes the pane
setTimeout(() => p.write('\x04'), 29000);        // Ctrl-D exits claude (or /exit)
setTimeout(() => {
  const out = path.join(__dirname, '..', 'test', 'fixtures', 'usage-pane-real.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stripAnsi(raw), 'utf8');
  console.log('wrote', out, stripAnsi(raw).length, 'chars');
  p.kill();
  process.exit(0);
}, 32000);
