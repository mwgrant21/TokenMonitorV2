const fsp = require('node:fs/promises');

class TranscriptTailer {
  constructor(filePath) {
    this.filePath = filePath;
    this.offset = 0;
  }

  async readNew() {
    const stat = await fsp.stat(this.filePath);
    if (stat.size <= this.offset) return [];

    const length = stat.size - this.offset;
    const buffer = Buffer.alloc(length);
    const fd = await fsp.open(this.filePath, 'r');
    try {
      await fd.read(buffer, 0, length, this.offset);
    } finally {
      await fd.close();
    }

    const text = buffer.toString('utf8');
    const lastNewlineIdx = text.lastIndexOf('\n');
    if (lastNewlineIdx === -1) return []; // no complete line yet

    const completeText = text.slice(0, lastNewlineIdx + 1);
    this.offset += Buffer.byteLength(completeText, 'utf8');
    return completeText.split('\n').filter((line) => line.length > 0);
  }
}

module.exports = { TranscriptTailer };
