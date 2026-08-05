// src/shared/ansiStrip.js
// Pure ANSI/control-sequence stripping for pty output. No fs, no Electron.
const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const OSC = /\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g;
const OTHER_ESC = /\x1b[@-_]/g;
const C0 = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g; // keep \n \t \r

function stripAnsi(chunk) {
  return String(chunk == null ? '' : chunk).replace(CSI, '').replace(OSC, '').replace(OTHER_ESC, '').replace(C0, '');
}

module.exports = { stripAnsi };
