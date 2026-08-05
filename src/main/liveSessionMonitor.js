const os = require('node:os');
const path = require('node:path');
const { findMostRecentSessionFile } = require('./activeSessionFinder');
const { TranscriptTailer } = require('./transcriptTailer');
const { parseTranscriptLine } = require('../shared/transcriptParser');

class LiveSessionMonitor {
  constructor({ aggregator, pollIntervalMs = 1000, findSessionTimeoutMs = 15000, homeDir = os.homedir() }) {
    this.aggregator = aggregator;
    this.pollIntervalMs = pollIntervalMs;
    this.findSessionTimeoutMs = findSessionTimeoutMs;
    this.homeDir = homeDir;
    this.projectsRoot = path.join(homeDir, '.claude', 'projects');
    this.tailer = null;
    this._timer = null;
    this._findDeadline = null;
    this._ticking = false; // re-entrancy guard: setInterval doesn't await _tick()
  }

  start() {
    this._findDeadline = Date.now() + this.findSessionTimeoutMs;
    this._timer = setInterval(() => this._tick(), this.pollIntervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _tick() {
    // setInterval fires on a fixed schedule regardless of whether the previous
    // _tick() has finished. Without this guard, a slow disk (AV scan, network
    // home dir) could let two ticks overlap and both read from the same stale
    // tailer offset, double-ingesting lines into the aggregator and corrupting
    // token/cost totals — the one thing this tool must get right.
    if (this._ticking) return;
    this._ticking = true;
    try {
      if (!this.tailer) {
        const activeFile = await findMostRecentSessionFile(this.projectsRoot);
        if (activeFile) {
          this.tailer = new TranscriptTailer(activeFile);
        } else if (Date.now() > this._findDeadline) {
          return; // gave up looking; call stop() then start() again for a fresh deadline
        } else {
          return; // keep waiting for Claude Code to create the transcript file
        }
      }

      const lines = await this.tailer.readNew();
      for (const line of lines) {
        const event = parseTranscriptLine(line);
        this.aggregator.ingest(event);
      }
    } finally {
      this._ticking = false;
    }
  }
}

module.exports = { LiveSessionMonitor };
