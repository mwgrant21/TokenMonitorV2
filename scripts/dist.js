const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildBuildInfo, BUILD_INFO_FILENAME } = require('../src/shared/buildInfo');
const { bumpArgs } = require('./bumpArgs');

const codesignDir = path.join(__dirname, '..', 'codesign');
const pfxPasswordFile = path.join(codesignDir, 'pfx-password.txt');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// The commit the build was cut from. A checkout without git history still builds --
// buildBuildInfo normalizes the miss to 'unknown' rather than inventing a sha.
function currentCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : undefined;
}

// Read from disk, not through require(): the bump rewrites package.json after this
// process started, and the cached module object would still hold the old version --
// which is precisely the stale-number bug the whole plan exists to kill.
function versionOnDisk() {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
}

// Bumps package.json, writes CHANGELOG.md, commits and tags -- all of it derived from
// the conventional-commit history, so no version is ever typed by hand. Runs before
// writeBuildInfo so the generated file and the tag describe the same commit.
//
// commit-and-tag-version, not standard-version: the latter is what the plan named, but
// it was sunset upstream and last published 2023-04-01. This is its maintained fork,
// same CLI and same config.
function bumpAndTag() {
  const args = bumpArgs(versionOnDisk(), process.argv.slice(2));
  console.log(`Bumping version: commit-and-tag-version ${args.join(' ')}`.trim());
  const result = spawnSync('npx', ['commit-and-tag-version', ...args], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('Version bump failed -- no build cut, nothing tagged.');
    process.exit(result.status ?? 1);
  }
}

// Written before electron-builder runs so the generated file is on disk in time to be
// collected by the files list. Generated, never committed: a committed copy is a semver
// literal in the tree by another name.
function writeBuildInfo() {
  const info = buildBuildInfo({ commit: currentCommit(), version: versionOnDisk() });
  const target = path.join(__dirname, '..', BUILD_INFO_FILENAME);
  fs.writeFileSync(target, JSON.stringify(info, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${BUILD_INFO_FILENAME}: ${info.version} (${info.commit}, ${info.channel})`);
  return info;
}

function requireFile(file, help) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}\n${help}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8').trim();
}

async function main() {
  // Signing material is checked before anything else: the bump commits and tags, and
  // discovering the cert is missing after that leaves a released version number on a
  // build that was never cut.
  const env = {
    ...process.env,
    CSC_KEY_PASSWORD: requireFile(
      pfxPasswordFile,
      'Run scripts/generate-codesign-cert.ps1 to create a matched cert + password.'
    ),
  };

  bumpAndTag();
  writeBuildInfo();

  const args = ['electron-builder'];

  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: true,
    env,
  });

  process.exit(result.status ?? 1);
}

main();
