const os = require('node:os');
const path = require('node:path');

function cwdToProjectDirName(cwd) {
  return cwd.replace(/[:\\.]/g, '-');
}

function projectDirForCwd(cwd, homeDir = os.homedir()) {
  return path.join(homeDir, '.claude', 'projects', cwdToProjectDirName(cwd));
}

module.exports = { cwdToProjectDirName, projectDirForCwd };
