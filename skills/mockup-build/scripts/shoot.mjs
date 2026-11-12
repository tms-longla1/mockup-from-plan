#!/usr/bin/env node
// Open the built mockup in headless Chrome: detect JS errors and empty states,
// then capture every screen in every state as a PNG.
// Usage: node shoot.mjs <feature-dir> [--fidelity mockup|wireframe|both] [--highlight] [--only <screen-id>] [--verify-only] [--png-dir <dir>]
// Output: <feature-dir>/dist/png/<fidelity>/NN-<screen>--<state>.png
// Exit code: 0 ok, 1 errors in the mockup, 3 no browser found.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

function args() {
  const a = process.argv.slice(2);
  const o = { dir: null, fidelity: 'mockup', highlight: false, only: null, verifyOnly: false, pngDir: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--fidelity') o.fidelity = a[++i];
    else if (a[i] === '--highlight') o.highlight = true;
    else if (a[i] === '--only') o.only = a[++i];
    else if (a[i] === '--verify-only') o.verifyOnly = true;
    else if (a[i] === '--png-dir') o.pngDir = path.resolve(a[++i]);
    else if (!o.dir) o.dir = a[i];
  }
  if (!o.dir || !['wireframe', 'mockup', 'both'].includes(o.fidelity)) {
    console.error('Usage: node shoot.mjs <feature-dir> [--fidelity mockup|wireframe|both] [--highlight] [--only <screen-id>] [--verify-only] [--png-dir <dir>]');
    process.exit(2);
  }
  o.dir = path.resolve(o.dir);
  return o;
}

export function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const list = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return list.find((p) => fs.existsSync(p)) || null;
}

function run(browser, flags, url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-shot-'));
  const base = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--disable-extensions', '--user-data-dir=' + profile, '--virtual-time-budget=2000'];
  return new Promise((resolve, reject) => {
    execFile(browser, [...base, ...flags, url], { maxBuffer: 64 * 1024 * 1024, timeout: 60000 }, (err, stdout) => {
      fs.rmSync(profile, { recursive: true, force: true });
      if (err) reject(err); else resolve(stdout);
    });
  });
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
}

const result = { errors: [], warnings: [], shots: [] };
function out(line) {
  console.log(line);
  if (line.startsWith('ERROR')) result.errors.push(line.replace(/^ERROR\s+/, ''));
  else if (line.startsWith('WARNING')) result.warnings.push(line.replace(/^WARNING\s+/, ''));
}

async function main() {
  const o = args();
  const browser = findBrowser();
  if (!browser) {
    out('Chrome/Chromium/Edge not found. Set CHROME_PATH to the browser executable and run again.');
    process.exit(3);
  }
  const M = JSON.parse(fs.readFileSync(path.join(o.dir, 'screens.json'), 'utf8'));
  const SIZE = { desktop: { width: 1440, minHeight: 900, scale: 1 }, mobile: { width: 390, minHeight: 844, scale: 2 } };
  const devices = [...new Set(M.screens.map((s) => ((s.device || M.device) === 'mobile' ? 'mobile' : 'desktop')))];
  let failed = false;

  for (const f of o.fidelity === 'both' ? ['wireframe', 'mockup'] : [o.fidelity]) {
    const file = path.join(o.dir, 'dist', f + '.html');
    if (!fs.existsSync(file)) { out(`ERROR     ${file} does not exist. Run build.mjs first.`); failed = true; continue; }
    const url = pathToFileURL(file).href;

    // Measure once per device type, because height depends on the window width.
    const res = { errors: [], shots: [] };
    let measured = true;
    for (const d of devices) {
      const dom = await run(browser, [`--window-size=${SIZE[d].width},${SIZE[d].minHeight}`, '--dump-dom'], url + '#measure=1');
      const m = dom.match(/<script type="application\/json" id="m-measure">([\s\S]*?)<\/script>/);
      if (!m) { measured = false; break; }
      const part = JSON.parse(m[1]);
      for (const e of part.errors) if (!res.errors.includes(e)) res.errors.push(e);
      res.shots.push(...part.shots.filter((s) => s.device === d));
    }
    if (!measured) { out(`ERROR     ${f}: the runtime did not finish (no measurements). Open the file in a browser and check the console.`); failed = true; continue; }
    const orderOf = Object.fromEntries(M.screens.map((s, i) => [s.id, i]));
    res.shots.sort((a, b) => orderOf[a.screen] - orderOf[b.screen]);
    for (const e of res.errors) { out(`ERROR     ${f}: ${e}`); failed = true; }
    for (const s of res.shots) {
      if (s.textLength === 0) { out(`ERROR     ${f}: ${s.screen} / ${s.state} shows no content`); failed = true; }
    }
    const byScreen = {};
    for (const s of res.shots) (byScreen[s.screen] ||= []).push(s);
    for (const [id, list] of Object.entries(byScreen)) {
      const sc = M.screens.find((x) => x.id === id);
      if (M.mode === 'existing-app' && sc && sc.existing && !sc.unchangedReason && list.every((s) => s.newMarks === 0)) {
        out(`WARNING   ${f}: existing screen ${id} shows no data-new part in any state`);
      }
    }
    out(`${f}: checked ${res.shots.length} screen/state combination(s), ${res.errors.length} runtime error(s)`);
    if (o.verifyOnly) continue;

    const outDir = path.join(o.pngDir || path.join(o.dir, 'dist', 'png'), f);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const jobs = [];
    res.shots.forEach((s, i) => {
      if (o.only && s.screen !== o.only) return;
      const name = `${String(i + 1).padStart(2, '0')}-${s.screen}--${s.state}`;
      const size = SIZE[s.device];
      const h = Math.min(Math.max(s.height, size.minHeight), 8000);
      jobs.push({ out: path.join(outDir, name + '.png'), h, size, screen: s.screen, state: s.state, hl: false, hash: `#s=${s.screen}&st=${s.state}&bare=1` });
      if (o.highlight && s.newMarks > 0) jobs.push({ out: path.join(outDir, name + '--new.png'), h, size, screen: s.screen, state: s.state, hl: true, hash: `#s=${s.screen}&st=${s.state}&bare=1&hl=1` });
    });
    await pool(jobs, 4, async (j) => {
      await run(browser, [`--window-size=${j.size.width},${j.h}`, `--force-device-scale-factor=${j.size.scale}`, `--screenshot=${j.out}`], url + j.hash);
      if (!fs.existsSync(j.out)) { out(`ERROR     Could not capture ${j.out}`); failed = true; }
    });
    for (const j of jobs) result.shots.push({ fidelity: f, screen: j.screen, state: j.state, highlight: j.hl, file: path.relative(o.dir, j.out).split(path.sep).join('/') });
    out(`${f}: captured ${jobs.length} image(s) into ${outDir}`);
    for (const j of jobs) out('  ' + j.out);
  }
  fs.writeFileSync(path.join(o.dir, 'dist', 'shoot.json'), JSON.stringify(result, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('ERROR     ' + (e.stack || e)); process.exit(1); });
}
