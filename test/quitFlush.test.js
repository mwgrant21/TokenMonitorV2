// test/quitFlush.test.js
// The last write before the app exits. Two ways to get this wrong, and the app-quit
// path punishes both: not waiting at all (the process exits mid-write and the seat's
// final snapshot is lost), or waiting forever (the fleet folder is an SMB share, and an
// unreachable one makes the app unquittable). So the outcome is always reported and the
// wait is always bounded.
const test = require('node:test');
const assert = require('node:assert/strict');

const { flushWithDeadline } = require('../src/main/quitFlush');

const never = () => new Promise(() => {});
const after = (ms, value) => () => new Promise((resolve) => setTimeout(() => resolve(value), ms));

test('reports written when the write finishes inside the deadline', async () => {
  assert.equal(await flushWithDeadline(after(5), 200), 'written');
});

test('reports timeout instead of hanging when the write never finishes', async () => {
  assert.equal(await flushWithDeadline(never, 20), 'timeout');
});

test('reports failed when the write rejects', async () => {
  assert.equal(await flushWithDeadline(() => Promise.reject(new Error('share gone')), 200), 'failed');
});

test('reports failed when the write throws before returning a promise', async () => {
  assert.equal(await flushWithDeadline(() => { throw new Error('bad argument'); }, 200), 'failed');
});

// Quit must not depend on this succeeding. Whatever happens, the caller gets an outcome
// to act on rather than an exception to handle on the way out of the process.
test('never rejects, whatever the write does', async () => {
  for (const write of [never, () => Promise.reject(new Error('x')), () => { throw new Error('y'); }]) {
    await assert.doesNotReject(() => flushWithDeadline(write, 20));
  }
});

// A write that loses the race and *then* fails would otherwise surface as an unhandled
// rejection during shutdown -- noise in the one log a user is most likely to send you.
test('a rejection arriving after the deadline is swallowed, not left unhandled', async () => {
  const unhandled = [];
  const onUnhandled = (err) => unhandled.push(err);
  process.on('unhandledRejection', onUnhandled);
  try {
    const outcome = await flushWithDeadline(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('late')), 30)),
      10
    );
    assert.equal(outcome, 'timeout');
    await new Promise((r) => setTimeout(r, 80));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('a write that wins the race leaves no timer holding the loop open', async () => {
  // If the deadline timer were left pending, this test would sit here for the full
  // deadline instead of returning as soon as the write resolves.
  const started = Date.now();
  await flushWithDeadline(after(5), 5000);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started}ms`);
});
