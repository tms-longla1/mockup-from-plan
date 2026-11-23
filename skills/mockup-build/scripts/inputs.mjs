#!/usr/bin/env node
// Normalize the inputs: take any mix of files/folders (plan, spec, requirements document,
// design files, screenshots, source code), classify them, then decide the slug and the mode
// by fixed rules. The result is mockups/<slug>/inputs.json, the shared starting point of every run.
//
// First run: node inputs.mjs <path...> [--out mockups] [--slug x] [--mode existing-app|new-product] [--outputs mockup,png] [--detail quick|full]
// Rerun:     node inputs.mjs --dir mockups/<slug> [<extra-path...>] [--outputs ...]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseOutputs, outputsText, ALL_OUTPUTS } from './check.mjs';

const DOC = new Set(['.md', '.markdown', '.txt']);
const DESIGN = new Set(['.html', '.htm']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const CODE = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.dart', '.swift', '.kt', '.css', '.scss', '.erb', '.blade.php', '.php']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.dart_tool', 'mockups']);
const UI_TYPES = new Set(['source-code', 'source-file', 'design-html', 'screenshot']);
const PRIMARY_ORDER = ['plan', 'spec', 'requirements', 'screen-description', 'document'];

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { paths: [], out: 'mockups', dir: null, slug: null, mode: null, outputs: null, detail: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--dir') o.dir = a[++i];
    else if (a[i] === '--slug') o.slug = a[++i];
    else if (a[i] === '--mode') o.mode = a[++i];
    else if (a[i] === '--detail') o.detail = a[++i];
    else if (a[i] === '--outputs') { try { o.outputs = parseOutputs(a[++i]); } catch (e) { console.error(e.message); process.exit(2); } }
    else o.paths.push(a[i]);
  }
  if (!o.paths.length && !o.dir) {
    console.error('Usage: node inputs.mjs <path...> [--out mockups] [--slug x] [--mode existing-app|new-product] [--outputs mockup,png]\n       node inputs.mjs --dir mockups/<slug> [<extra-path...>] [--outputs ...]');
    process.exit(2);
  }
  if (o.mode && !['existing-app', 'new-product'].includes(o.mode)) { console.error('--mode must be existing-app or new-product'); process.exit(2); }
  if (o.detail && !['quick', 'full'].includes(o.detail)) { console.error('--detail must be quick or full'); process.exit(2); }
  return o;
}

const rel = (p) => path.relative(process.cwd(), path.resolve(p)).split(path.sep).join('/') || '.';

function langOf(name) {
  const m = name.match(/[._-](vi|vn|en|ja|jp)(?=\.[a-z]+$)/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return v === 'vn' ? 'vi' : v === 'jp' ? 'ja' : v;
}

function classifyDoc(file) {
  const name = path.basename(file);
  const head = fs.readFileSync(file, 'utf8').slice(0, 6000);
  const meta = {};
  const fm = head.match(/^---\n([\s\S]*?)\n---/);
  if (fm) for (const line of fm[1].split('\n')) { const m = line.match(/^(redmine_id|tracker|status|project):\s*(.+)$/); if (m) meta[m[1]] = m[2].trim(); }
  const h1 = (head.match(/^#\s+(.+)$/m) || [])[1] || '';
  let type = 'document';
  if (/test[-_ ]?case/i.test(name)) type = 'test-case';
  else if (meta.redmine_id || meta.tracker) type = 'spec';
  else if (/^plan[-_]/i.test(name) || /^plan\b/i.test(h1)) type = 'plan';
  else if (/screen[-_ ]description|画面(説明|定義|仕様)|mobile-guide/i.test(name) || /Giải thích các màn hình|画面説明/i.test(head)) type = 'screen-description';
  else if (/要件定義|requirement/i.test(name) || /Định nghĩa Yêu cầu|要件定義/i.test(h1)) type = 'requirements';
  else if (/^(spec|us|cr|epic|bug)[-_]|\d{4,}-(us|cr|epic|bug)-/i.test(name)) type = 'spec';
  return { type, meta: Object.keys(meta).length ? meta : undefined, title: h1 || undefined };
}

function stackOf(dir) {
  const hints = [];
  const pkg = path.join(dir, 'package.json');
  if (fs.existsSync(pkg)) {
    try {
      const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      const deps = { ...j.dependencies, ...j.devDependencies };
      for (const k of ['next', 'react', 'vue', 'nuxt', '@angular/core', 'svelte', 'react-native', 'expo', 'tailwindcss', '@mui/material', 'antd', '@chakra-ui/react', 'bootstrap']) if (deps[k]) hints.push(k);
    } catch { /* ignore a broken package.json */ }
  }
  if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) hints.push('flutter');
  if (fs.existsSync(path.join(dir, 'Gemfile'))) hints.push('rails');
  if (fs.existsSync(path.join(dir, 'composer.json'))) hints.push('php');
  return hints;
}

function looksLikeSource(dir) {
  if (['package.json', 'pubspec.yaml', 'Gemfile', 'composer.json', 'build.gradle', 'Podfile'].some((f) => fs.existsSync(path.join(dir, f)))) return true;
  return fs.readdirSync(dir).some((f) => CODE.has(path.extname(f)));
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
}

function describe(p, list) {
  if (!fs.existsSync(p)) { list.push({ path: rel(p), type: 'missing' }); return; }
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (looksLikeSource(p)) { list.push({ path: rel(p), type: 'source-code', stack: stackOf(p) }); return; }
    const files = [];
    walk(p, files);
    files.sort().forEach((f) => describe(f, list));
    return;
  }
  const ext = path.extname(p).toLowerCase();
  const item = { path: rel(p), type: 'ignored', bytes: st.size };
  if (DOC.has(ext)) Object.assign(item, classifyDoc(p));
  else if (DESIGN.has(ext)) item.type = 'design-html';
  else if (IMAGE.has(ext)) item.type = 'screenshot';
  else if (CODE.has(ext)) item.type = 'source-file';
  if (item.type !== 'ignored') item.sha256 = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
  const lang = langOf(path.basename(p));
  if (lang) item.lang = lang;
  if (st.size > 60 * 1024 && DOC.has(ext)) item.large = true;
  list.push(item);
}

function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function slugFrom(item) {
  let base = path.basename(item.path).replace(/\.[a-z]+$/i, '').replace(/[._-](vi|vn|en|ja|jp)$/i, '').replace(/^plan[-_]/i, '');
  let s = slugify(base);
  if (s.length > 48) s = s.slice(0, 48).replace(/-[^-]*$/, '');
  // The file name gives no usable slug (digits only, too short, non-Latin): fall back to the title.
  if (!/[a-z]{3}/.test(s) && item.title) {
    s = slugify(item.title);
    if (s.length > 48) s = s.slice(0, 48).replace(/-[^-]*$/, '');
  }
  if (!/[a-z]{3}/.test(s)) s = 'feature-' + ((item.meta && item.meta.redmine_id) || item.sha256.slice(0, 8));
  return s;
}

function main() {
  const o = parseArgs();
  let prev = null;
  if (o.dir) {
    const f = path.join(o.dir, 'inputs.json');
    if (!fs.existsSync(f)) { console.error('Not found: ' + f); process.exit(2); }
    prev = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  const wanted = [...(prev ? prev.requested : []), ...o.paths.map(rel)].filter((v, i, a) => a.indexOf(v) === i);
  const list = [];
  wanted.forEach((p) => describe(p, list));
  const inputs = list.filter((v, i, a) => a.findIndex((x) => x.path === v.path) === i);

  const missing = inputs.filter((x) => x.type === 'missing');
  if (missing.length) { for (const m of missing) console.log('ERROR     Not found: ' + m.path); process.exit(1); }

  // Translation: a file with a language suffix whose original (same name without it) is also in the list.
  for (const it of inputs) {
    if (!it.lang) continue;
    const orig = it.path.replace(/[._-](vi|vn|en|ja|jp)(?=\.[a-z]+$)/i, '');
    if (inputs.some((x) => x.path === orig)) it.translationOf = orig;
  }
  for (const it of inputs) {
    if (UI_TYPES.has(it.type)) it.role = 'ui-source';
    else if (it.type === 'ignored') it.role = 'ignored';
    else it.role = 'supporting';
  }
  let primary = null;
  for (const t of PRIMARY_ORDER) { primary = inputs.find((x) => x.type === t && !x.translationOf); if (primary) break; }
  if (!primary) { console.log('ERROR     No plan/spec/document among the inputs. At least one file describing the feature is required.'); process.exit(1); }
  primary.role = 'primary';

  // Mode: a UI source among the inputs, or a primary document that mentions existing source files, means an existing app.
  const refs = (fs.readFileSync(primary.path, 'utf8').match(/[\w@./-]+\.(tsx|jsx|vue|svelte|dart|swift|kt|erb|blade\.php)\b/g) || []).length;
  const hasUi = inputs.some((x) => x.role === 'ui-source');
  let mode, modeReason;
  if (o.mode) { mode = o.mode; modeReason = 'set with --mode'; }
  else if (prev && prev.mode) { mode = prev.mode; modeReason = prev.modeReason || 'kept from the previous run'; }
  else if (hasUi) { mode = 'existing-app'; modeReason = 'the inputs include a UI source'; }
  else if (refs >= 2) { mode = 'existing-app'; modeReason = `the primary document mentions ${refs} existing source file(s)`; }
  else { mode = 'new-product'; modeReason = 'no UI source and the document does not mention existing source files'; }
  const slug = o.slug || (prev && prev.slug) || slugFrom(primary);
  const dir = o.dir || path.join(o.out, slug);
  fs.mkdirSync(path.join(dir, 'screens', '_partials'), { recursive: true });

  const outputs = o.outputs || (prev && prev.outputs) || { ...ALL_OUTPUTS };
  // quick: a fast sketch in the neutral kit, existing screens shown only around what changes. full: looks like the real app.
  const detail = o.detail || (prev && prev.detail) || 'full';
  const result = { version: 1, slug, mode, modeReason, detail, outputs, primary: primary.path, requested: wanted, inputs };
  fs.writeFileSync(path.join(dir, 'inputs.json'), JSON.stringify(result, null, 2) + '\n');

  // new-product and quick sketches always get a theme.json pointing at the kit, so every mockup folder has the same set of files.
  const theme = path.join(dir, 'theme.json');
  if ((mode === 'new-product' || detail === 'quick') && !fs.existsSync(theme)) {
    fs.writeFileSync(theme, JSON.stringify({ source: 'kit-default', allowEmoji: false, notes: mode === 'new-product' ? 'New product: uses the neutral kit.' : 'Quick sketch: uses the neutral kit instead of the app look.', tokens: {} }, null, 2) + '\n');
  }

  console.log(`Folder:   ${rel(dir)}`);
  console.log(`Slug:     ${slug}`);
  console.log(`Mode:     ${mode} (${modeReason})`);
  console.log(`Primary:  ${primary.path} (${primary.type})`);
  console.log(`Detail:   ${detail}`);
  console.log(`Outputs:  ${outputsText(outputs)}`);
  const counts = {};
  for (const it of inputs) counts[it.type] = (counts[it.type] || 0) + 1;
  console.log('Inputs:   ' + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '));
  for (const it of inputs.filter((x) => x.large)) console.log(`WARNING   Large file, read only the relevant sections: ${it.path} (${Math.round(it.bytes / 1024)} KB)`);
  if (mode === 'existing-app' && !hasUi && detail === 'full') console.log('WARNING   Mode is existing-app but there is no UI source (source code, design files, screenshots). Ask the user for a path; if there is none, build from the description and record it as an assumption.');

  if (prev) {
    const before = Object.fromEntries(prev.inputs.map((x) => [x.path, x.sha256]));
    const now = Object.fromEntries(inputs.map((x) => [x.path, x.sha256]));
    const changed = Object.keys(now).filter((p) => p in before && before[p] !== now[p]);
    const added = Object.keys(now).filter((p) => !(p in before));
    const removed = Object.keys(before).filter((p) => !(p in now));
    console.log(`Since the last run: ${changed.length} changed, ${added.length} added, ${removed.length} removed`);
    for (const p of changed) console.log('  CHANGED  ' + p);
    for (const p of added) console.log('  ADDED    ' + p);
    for (const p of removed) console.log('  REMOVED  ' + p);
  }
}

main();
