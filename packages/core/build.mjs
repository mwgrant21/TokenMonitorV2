// Dual ESM + CJS build with no bundler.
// TokenMonitor's renderer/main are CommonJS with no build step; Aether is ESM/TS.
// tsc emits ESM, then a mechanical transform produces the CJS entry. Pure logic
// only (no deps, no dynamic import), which is what makes the transform safe.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

rmSync('dist', { recursive: true, force: true });
execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });

mkdirSync('dist/cjs', { recursive: true });
const files = readdirSync('dist/esm').filter((f) => f.endsWith('.js'));
const localNames = new Set(files.map((f) => f.replace(/\.js$/, '')));

for (const f of files) {
  let src = readFileSync(join('dist/esm', f), 'utf8');
  const requires = [];
  // `import { a, b } from './x.js'` -> const { a, b } = require('./x.cjs')
  src = src.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/([\w.]+?)(?:\.js)?['"];?$/gm, (_m, names, mod) => {
    requires.push(`const {${names}} = require('./${mod}.cjs');`);
    return '';
  });
  // `import x from 'node:path'` -> const x = require('node:path')
  src = src.replace(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, (_m, name, mod) => {
    requires.push(`const ${name} = require('${mod}');`);
    return '';
  });
  const exported = [];
  src = src.replace(/^export\s+(function|const|class)\s+(\w+)/gm, (_m, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  src = src.replace(/^export\s+\{[^}]*\};?$/gm, '');
  const out = `'use strict';\n${requires.join('\n')}\n${src}\nmodule.exports = { ${exported.join(', ')} };\n`;
  writeFileSync(join('dist/cjs', f.replace(/\.js$/, '.cjs')), out);
}
if (!localNames.has('index')) throw new Error('expected src/index.ts');
console.log(`built ${files.length} module(s) -> dist/esm (ESM) + dist/cjs (CJS)`);
