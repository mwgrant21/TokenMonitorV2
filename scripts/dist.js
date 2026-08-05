const { spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const publish = process.argv.includes('--publish');

const secretsDir = path.join(__dirname, '..', 'secrets');
const codesignDir = path.join(__dirname, '..', 'codesign');
const pfxPasswordFile = path.join(codesignDir, 'pfx-password.txt');
const updateTokenFile = path.join(secretsDir, 'update-token.txt');
const publishTokenFile = path.join(secretsDir, 'publish-token.txt');

const GITHUB_OWNER = 'mwgrant21';
const GITHUB_REPO = 'TokenMonitor';

function requireFile(file, help) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}\n${help}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8').trim();
}

function githubRequest(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'tokentracker-dist-script',
          Accept: 'application/vnd.github+json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, json: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// electron-builder spawns a separate GitHub publisher instance per artifact
// group (installer+blockmap vs. latest.yml), and each independently races to
// "find or create" the release. Neither knows about the other, so both can
// create a release simultaneously, splitting assets across two drafts. Pre-
// creating the draft release ourselves means both instances find the same
// existing release instead of racing to create it.
async function ensureRelease(token, version) {
  const tag = `v${version}`;
  const { json: releases } = await githubRequest('GET', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`, token);
  if (releases.some((r) => r.tag_name === tag)) return;
  // draft: false - published immediately so electron-updater's releases feed
  // picks it up right away; office machines auto-update with no manual
  // "publish" click needed on GitHub.
  const { status, json } = await githubRequest('POST', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`, token, {
    tag_name: tag,
    name: version,
    draft: false,
  });
  if (status !== 201) {
    console.error(`Failed to pre-create GitHub release: ${status} ${JSON.stringify(json)}`);
    process.exit(1);
  }
}

async function main() {
  const env = {
    ...process.env,
    CSC_KEY_PASSWORD: requireFile(
      pfxPasswordFile,
      'Run scripts/generate-codesign-cert.ps1 to create a matched cert + password.'
    ),
  };

  // Always required: it's embedded into the package via extraResources so
  // installed clients can authenticate their update checks against the
  // private repo. Missing it fails the electron-builder packaging step
  // anyway, but this gives a clearer message up front.
  requireFile(
    updateTokenFile,
    'Create a fine-grained GitHub PAT scoped to Contents:Read-only on this repo ' +
    'and save it to secrets/update-token.txt.'
  );

  if (publish) {
    env.GH_TOKEN = requireFile(
      publishTokenFile,
      'Create a fine-grained GitHub PAT scoped to Contents:Read-and-write on this repo ' +
      'and save it to secrets/publish-token.txt.'
    );
    const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    await ensureRelease(env.GH_TOKEN, version);
  }

  const args = ['electron-builder'];
  if (publish) args.push('--publish', 'always');

  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: true,
    env,
  });

  process.exit(result.status ?? 1);
}

main();
