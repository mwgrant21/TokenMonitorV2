// src/main/quitFlush.js
// Bounded last write before the app exits. No Electron import, so the behaviour that
// matters can be tested without driving an app lifecycle.
//
// Why this exists: 'before-quit' used to fire writeFleetSnapshot and return
// immediately, so the process could exit mid-write and the seat's final snapshot --
// the one carrying its last spend figures and, since the version column shipped, its
// app version -- was lost whenever the write lost the race. Awaiting it fixes that and
// introduces the opposite failure: the fleet folder is a network share, and an
// unreachable one would leave the app refusing to quit.
//
// So the wait is bounded, and the outcome is always reported rather than thrown. Quit
// is not allowed to depend on this succeeding.

const TIMEOUT = Symbol('timeout');

// flushWithDeadline(write, timeoutMs) -> 'written' | 'timeout' | 'failed'
// Never rejects: the caller is on its way out of the process and has nowhere to put an
// exception.
async function flushWithDeadline(write, timeoutMs) {
  let timer = null;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
  });

  let attempt;
  try {
    attempt = Promise.resolve(write());
  } catch {
    // A synchronous throw is still a failed write, not a crash on the way out.
    clearTimeout(timer);
    return 'failed';
  }

  // Settled separately from the race: a write that loses and then rejects would
  // otherwise surface as an unhandled rejection during shutdown, which is noise in the
  // one log a user is most likely to send you.
  const settled = attempt.then(() => 'written', () => 'failed');

  const outcome = await Promise.race([settled, deadline]);
  // Cleared on the winning path too, so a short write does not leave a long timer
  // holding the loop open behind it.
  clearTimeout(timer);
  return outcome === TIMEOUT ? 'timeout' : outcome;
}

module.exports = { flushWithDeadline };
