#!/usr/bin/env node
// Assemble screens.json + screens/*.html (+ theme.json, custom.css) into a self-contained HTML file.
// Usage: node build.mjs <feature-dir> [--fidelity wireframe|mockup|both]
// Output: <feature-dir>/dist/wireframe.html and/or dist/mockup.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFeature, loadFragment } from './check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', 'assets');
const read = (p) => fs.readFileSync(p, 'utf8');

function args() {
  const a = process.argv.slice(2);
  const out = { dir: null, fidelity: 'both' };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--fidelity') out.fidelity = a[++i];
    else if (!out.dir) out.dir = a[i];
  }
  if (!out.dir || !['wireframe', 'mockup', 'both'].includes(out.fidelity)) {
    console.error('Usage: node build.mjs <feature-dir> [--fidelity wireframe|mockup|both]');
    process.exit(2);
  }
  out.dir = path.resolve(out.dir);
  return out;
}

function themeCss(theme) {
  const tokens = theme.tokens || {};
  const lines = Object.entries(tokens).map(([k, v]) => {
    if (!/^[a-z0-9-]+$/.test(k) || /[;{}<]/.test(String(v))) throw new Error('Invalid token in theme.json: ' + k);
    return `  --${k}: ${v};`;
  });
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '';
}

// JSON embedded in <script>: neutralize closing-tag sequences.
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function main() {
  const { dir, fidelity } = args();
  const { errors, warnings, manifest: M, theme } = checkFeature(dir);
  for (const w of warnings) console.log('WARNING   ' + w);
  if (errors.length) {
    for (const e of errors) console.log('ERROR     ' + e);
    console.log(`\nNot built: ${errors.length} error(s). Fix them and run again.`);
    process.exit(1);
  }

  const shell = read(path.join(ASSETS, 'shell.html'));
  const templates = M.screens
    .map((s) => `<template id="tpl-${s.id}">\n${loadFragment(dir, s.id)}\n</template>`)
    .join('\n');
  const customPath = path.join(dir, 'custom.css');
  const custom = fs.existsSync(customPath) ? read(customPath) : '';
  const dist = path.join(dir, 'dist');
  fs.mkdirSync(dist, { recursive: true });

  const targets = fidelity === 'both' ? ['wireframe', 'mockup'] : [fidelity];
  for (const f of targets) {
    const parts = {
      UI_LANG: esc(M.uiLang || M.lang),
      FIDELITY: f,
      TITLE: esc(`${M.feature} (${f})`),
      KIT_CSS: read(path.join(ASSETS, 'kit.css')),
      // The wireframe drops the color theme; custom.css stays because it also carries layout, and the grayscale filter removes its colors.
      THEME_CSS: f === 'mockup' ? themeCss(theme || {}) : '',
      CUSTOM_CSS: custom,
      VIEWER_CSS: read(path.join(ASSETS, 'viewer.css')),
      TEMPLATES: templates,
      MANIFEST_JSON: safeJson(M),
      ICONS_JSON: safeJson(JSON.parse(read(path.join(ASSETS, 'icons.json')))),
      RUNTIME_JS: read(path.join(ASSETS, 'runtime.js'))
    };
    const html = shell.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in parts ? parts[k] : m));
    const out = path.join(dist, f + '.html');
    fs.writeFileSync(out, html);
    console.log(`Wrote ${out} (${Math.round(Buffer.byteLength(html) / 1024)} KB, ${M.screens.length} screen(s))`);
  }
}

main();
