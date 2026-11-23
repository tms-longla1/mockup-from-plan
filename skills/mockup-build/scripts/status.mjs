#!/usr/bin/env node
// Starting point for every session: checks the environment, lists the mockups already built in
// this project (and whether their documents changed since), and suggests documents that look like
// a plan or spec. The output is meant to be read by the model before it asks the user anything.
// Usage: node status.mjs [--out mockups]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { findBrowser } from './shoot.mjs';
import { outputsText } from './check.mjs';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor', 'tmp', 'log', 'coverage', '.dart_tool', 'mockups']);
const DOC_HINT = /(^|[-_ ./])(plan|spec|prd|requirement|story|ticket|feature|design|us|cr)([-_ ./]|$)|要件|仕様|画面|設計/i;

function args() {
  const a = process.argv.slice(2);
  const o = { out: 'mockups' };
  for (let i = 0; i < a.length; i++) if (a[i] === '--out') o.out = a[++i];
  return o;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

function environment() {
  const major = +process.versions.node.split('.')[0];
  const browser = findBrowser();
  console.log('## Environment');
  console.log(`node:     ${process.versions.node}${major < 18 ? '  (too old: Node 18 or later is required)' : ''}`);
  console.log(`browser:  ${browser || 'NOT FOUND (images and the visual check will be skipped; set CHROME_PATH to fix)'}`);
  return { ok: major >= 18, browser: !!browser };
}

function mockups(root) {
  console.log('\n## Existing mockups');
  if (!fs.existsSync(root)) { console.log('none'); return; }
  const dirs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'inputs.json'))).sort();
  if (!dirs.length) { console.log('none'); return; }
  for (const d of dirs) {
    const dir = path.join(root, d);
    const inputs = JSON.parse(fs.readFileSync(path.join(dir, 'inputs.json'), 'utf8'));
    const repPath = path.join(dir, 'dist', 'report.json');
    const rep = fs.existsSync(repPath) ? JSON.parse(fs.readFileSync(repPath, 'utf8')) : null;
    const changed = [];
    for (const it of inputs.inputs) {
      if (!it.sha256) continue;
      if (!fs.existsSync(it.path)) changed.push('missing ' + it.path);
      else if (sha(it.path) !== it.sha256) changed.push('changed ' + it.path);
    }
    const status = rep ? rep.status : (fs.existsSync(path.join(dir, 'screens.json')) ? 'not built' : 'not started');
    console.log(`- ${d}: ${rep ? rep.feature : '(no report yet)'}`);
    console.log(`    status: ${status}; mode: ${inputs.mode}; detail: ${inputs.detail || 'full'}; outputs: ${outputsText(inputs.outputs)}; primary: ${inputs.primary}`);
    if (rep) console.log(`    ${rep.screens} screen(s), ${rep.states} state(s), ${rep.assumptions} assumption(s), ${rep.openQuestions} open question(s)`);
    console.log(`    documents: ${changed.length ? changed.join('; ') : 'unchanged since the last run'}`);
  }
}

function suggestions(root) {
  console.log('\n## Candidate documents (most recently modified first)');
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    // Skill and plugin packages hold instructions, not feature documents.
    if (entries.some((e) => e.name === 'SKILL.md' || e.name === 'plugin.json')) return;
    if (path.basename(dir) === 'skills' && entries.some((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))) return;
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.(md|markdown|txt)$/i.test(e.name) && !/^(readme|changelog|license|contributing|claude|agents)\b/i.test(e.name) && DOC_HINT.test(path.relative(root, p))) {
        found.push({ p: path.relative(root, p).split(path.sep).join('/'), t: fs.statSync(p).mtimeMs });
      }
    }
  };
  walk(root, 0);
  found.sort((a, b) => b.t - a.t);
  if (!found.length) console.log('none found');
  for (const f of found.slice(0, 12)) console.log(`- ${f.p}  (${new Date(f.t).toISOString().slice(0, 10)})`);
  if (found.length > 12) console.log(`... and ${found.length - 12} more`);
}

const o = args();
environment();
mockups(path.resolve(o.out));
suggestions(process.cwd());
