const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const secretsDir = path.join(__dirname, '..', 'secrets');
const codesignDir = path.join(__dirname, '..', 'codesign');
const pfxPasswordFile = path.join(codesignDir, 'pfx-password.txt');

function requireFile(file, help) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}\n${help}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8').trim();
}

async function main() {
  const env = {
    ...process.env,
    CSC_KEY_PASSWORD: requireFile(
      pfxPasswordFile,
      'Run scripts/generate-codesign-cert.ps1 to create a matched cert + password.'
    ),
  };

  const args = ['electron-builder'];

  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: true,
    env,
  });

  process.exit(result.status ?? 1);
}

main();
