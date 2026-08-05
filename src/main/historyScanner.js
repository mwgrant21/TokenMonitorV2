// src/main/historyScanner.js
const fsp = require('node:fs/promises');
const path = require('node:path');
const { parseTranscriptLine } = require('../shared/transcriptParser');

async function scanAllProjects(projectsRoot) {
  const events = [];
  let projectDirs;
  try {
    projectDirs = await fsp.readdir(projectsRoot, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return events;
    throw err;
  }

  for (const dirEntry of projectDirs) {
    if (!dirEntry.isDirectory()) continue;
    const dirPath = path.join(projectsRoot, dirEntry.name);
    const files = await fsp.readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const content = await fsp.readFile(path.join(dirPath, file), 'utf8');
      for (const line of content.split('\n')) {
        const event = parseTranscriptLine(line);
        if (event) events.push(event);
      }
    }
  }
  return events;
}

module.exports = { scanAllProjects };
