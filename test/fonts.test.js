// test/fonts.test.js
// Every @font-face src must resolve to a file that actually exists on disk, and
// index.html must link the stylesheet that declares them.
//
// A wrong relative path here does not throw and does not look broken: the browser
// silently falls through --f-ui's next choice (Bahnschrift, Segoe UI) and the app
// still renders as a plausibly restyled app. "It looks different" is therefore not
// evidence the fonts loaded - which is exactly how a font 404 hides. This test is
// the deterministic version of the document.fonts.check() spot-check.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const STYLES_DIR = path.join(__dirname, '..', 'src', 'renderer', 'styles');
const FONTS_CSS = path.join(STYLES_DIR, 'fonts.css');
const INDEX_HTML = path.join(__dirname, '..', 'src', 'renderer', 'index.html');

const css = fs.readFileSync(FONTS_CSS, 'utf8');
const html = fs.readFileSync(INDEX_HTML, 'utf8');

// [family, weight] pairs the token layer actually asks for. --f-ui leads with
// Rajdhani and --f-mono with Space Mono (tokens.css:6-7); the weights are the ones
// the prototype uses for labels and numbers.
const REQUIRED = [
  ['Rajdhani', 400], ['Rajdhani', 500], ['Rajdhani', 600], ['Rajdhani', 700],
  ['Space Mono', 400], ['Space Mono', 700],
];

// One capture per @font-face block: family, weight, and the url() target.
function parseFaces(source) {
  const faces = [];
  const blockRe = /@font-face\s*\{([^}]*)\}/g;
  let block;
  while ((block = blockRe.exec(source)) !== null) {
    const body = block[1];
    const family = /font-family:\s*'([^']+)'/.exec(body);
    const weight = /font-weight:\s*(\d+)/.exec(body);
    const url = /url\(\s*'([^']+)'\s*\)/.exec(body);
    faces.push({
      family: family && family[1],
      weight: weight && Number(weight[1]),
      url: url && url[1],
    });
  }
  return faces;
}

const faces = parseFaces(css);

test('fonts.css declares one @font-face per required family/weight', () => {
  assert.strictEqual(faces.length, REQUIRED.length,
    `expected ${REQUIRED.length} @font-face blocks, found ${faces.length}`);
  for (const [family, weight] of REQUIRED) {
    const hit = faces.find((f) => f.family === family && f.weight === weight);
    assert.ok(hit, `no @font-face for ${family} ${weight}`);
  }
});

test('every @font-face src resolves to a file that exists on disk', () => {
  for (const face of faces) {
    assert.ok(face.url, `@font-face for ${face.family} ${face.weight} has no url()`);
    // Resolved from the stylesheet's directory, which is how a browser resolves it -
    // NOT from the document. That one-directory difference is the whole failure mode.
    const resolved = path.resolve(STYLES_DIR, face.url);
    assert.ok(fs.existsSync(resolved),
      `${face.family} ${face.weight}: ${face.url} resolves to ${resolved}, which does not exist`);
    assert.ok(fs.statSync(resolved).size > 0,
      `${face.family} ${face.weight}: ${face.url} exists but is empty`);
  }
});

test('the woff2 files are real woff2, not LFS pointers or truncated copies', () => {
  for (const face of faces) {
    const fd = fs.openSync(path.resolve(STYLES_DIR, face.url), 'r');
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    fs.closeSync(fd);
    // woff2 files begin with the signature 'wOF2'.
    assert.strictEqual(magic.toString('latin1'), 'wOF2',
      `${face.url} does not start with the wOF2 signature`);
  }
});

test('index.html links fonts.css before tokens.css', () => {
  const fontsAt = html.indexOf('styles/fonts.css');
  const tokensAt = html.indexOf('styles/tokens.css');
  assert.ok(fontsAt !== -1, 'index.html does not link styles/fonts.css');
  assert.ok(tokensAt !== -1, 'index.html does not link styles/tokens.css');
  assert.ok(fontsAt < tokensAt, 'fonts.css must be linked before tokens.css');
});

test('the fonts are self-hosted, not loaded from node_modules or the network', () => {
  // electron-builder packs src/**/*; a renderer resolving fonts out of node_modules
  // or off a CDN breaks in a packaged build and breaks offline.
  for (const face of faces) {
    assert.ok(!/^https?:|^\/\/|node_modules/.test(face.url),
      `${face.url} is not a self-hosted relative path`);
  }
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html),
    'index.html still references a Google Fonts host');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(css),
    'fonts.css still references a Google Fonts host');
});
