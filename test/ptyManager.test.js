// test/ptyManager.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnPty, CLAUDE_LAUNCH_COMMAND } = require('../src/main/ptyManager');

test('spawnPty starts a real shell and emits data', async () => {
  const ptyProcess = spawnPty({ cwd: process.cwd(), cols: 80, rows: 24, shellOverride: 'cmd.exe', autoLaunchClaude: false });
  const output = await new Promise((resolve) => {
    let buffer = '';
    ptyProcess.onData((chunk) => {
      buffer += chunk;
      if (buffer.includes('hello-from-pty')) resolve(buffer);
    });
    ptyProcess.write('echo hello-from-pty\r');
  });
  assert.match(output, /hello-from-pty/);
  ptyProcess.kill();
});

test('auto-launch types exactly a plain claude command (fresh session, no resume flags)', () => {
  const writes = [];
  const fakePtyLib = {
    spawn: () => ({ write: (s) => writes.push(s), onData: () => {}, resize: () => {}, kill: () => {} }),
  };
  spawnPty({ ptyLib: fakePtyLib });
  assert.deepStrictEqual(writes, ['claude\r']);
  assert.strictEqual(CLAUDE_LAUNCH_COMMAND, 'claude\r');
  assert.doesNotMatch(CLAUDE_LAUNCH_COMMAND, /--continue|--resume|\s-c\b|\s-r\b/);
});

test('autoLaunchClaude:false writes nothing', () => {
  const writes = [];
  const fakePtyLib = {
    spawn: () => ({ write: (s) => writes.push(s), onData: () => {}, resize: () => {}, kill: () => {} }),
  };
  spawnPty({ autoLaunchClaude: false, ptyLib: fakePtyLib });
  assert.deepStrictEqual(writes, []);
});
