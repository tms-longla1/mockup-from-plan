#!/usr/bin/env node
// Open the built mockup in headless Chrome: detect JS errors and empty states,
// then capture every screen in every state as a PNG, plus review sheets that show all of them at once.
// One browser process drives one page through the runtime's capture API (Chrome DevTools Protocol
// over a pipe), so capturing many images takes seconds. If that fails, it falls back to one
// browser process per image.
// Usage: node shoot.mjs <feature-dir> [--fidelity mockup|wireframe|both] [--highlight] [--only <screen-id>]
//                       [--verify-only] [--png-dir <dir>] [--sheet-dir <dir>]
// Output: <feature-dir>/dist/png/<fidelity>/NN-<screen>--<state>.png, and <sheet-dir>/sheet-N.png when asked.
// Exit code: 0 ok, 1 errors in the mockup, 3 no browser found.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SIZE = { desktop: { width: 1440, minHeight: 900, scale: 1 }, mobile: { width: 390, minHeight: 844, scale: 2 } };
const BASE_FLAGS = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-extensions'];

function args() {
  const a = process.argv.slice(2);
  const o = { dir: null, fidelity: 'mockup', highlight: false, only: null, verifyOnly: false, pngDir: null, sheetDir: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--fidelity') o.fidelity = a[++i];
    else if (a[i] === '--highlight') o.highlight = true;
    else if (a[i] === '--only') o.only = a[++i];
    else if (a[i] === '--verify-only') o.verifyOnly = true;
    else if (a[i] === '--png-dir') o.pngDir = path.resolve(a[++i]);
    else if (a[i] === '--sheet-dir') o.sheetDir = path.resolve(a[++i]);
    else if (!o.dir) o.dir = a[i];
  }
  if (!o.dir || !['wireframe', 'mockup', 'both'].includes(o.fidelity)) {
    console.error('Usage: node shoot.mjs <feature-dir> [--fidelity mockup|wireframe|both] [--highlight] [--only <screen-id>] [--verify-only] [--png-dir <dir>] [--sheet-dir <dir>]');
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

// ---- Fast driver: one browser, one page, Chrome DevTools Protocol over --remote-debugging-pipe.
export async function cdpDriver(browser) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-shot-'));
  const child = spawn(browser, [...BASE_FLAGS, '--remote-debugging-pipe', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const toChrome = child.stdio[3];
  const fromChrome = child.stdio[4];
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  let buf = '';
  fromChrome.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method) listeners.forEach((fn) => fn(msg));
    }
  });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  child.on('error', () => {});
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    toChrome.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Timed out: ' + method)); } }, 30000);
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const pageErrors = [];
  listeners.push((m) => {
    if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      pageErrors.push((d.exception && d.exception.description) || d.text);
    }
  });
  await page('Page.enable');
  await page('Runtime.enable');

  const evaluate = async (expression) => {
    const r = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  const viewport = (width, height, scale) => page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  const settle = () => evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const capture = async (file) => {
    await settle();
    const { data } = await page('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  };

  return {
    kind: 'cdp',
    evaluate, capture, viewport,
    async load(url) {
      pageErrors.length = 0;
      const go = async (u) => {
        const loaded = new Promise((resolve) => {
          const fn = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(fn), 1); resolve(); } };
          listeners.push(fn);
        });
        await page('Page.navigate', { url: u });
        await Promise.race([loaded, new Promise((r) => setTimeout(r, 10000))]);
      };
      await viewport(SIZE.desktop.width, SIZE.desktop.minHeight, 1);
      // Leave the current document first: a URL that differs only by #hash would not reload the runtime.
      await go('about:blank');
      await go(url);
      for (let i = 0; i < 50 && !(await evaluate('!!window.__mockup')); i++) await new Promise((r) => setTimeout(r, 50));
      if (!(await evaluate('!!window.__mockup'))) throw new Error('the runtime did not start');
    },
    async measure(device) {
      await viewport(SIZE[device].width, SIZE[device].minHeight, 1);
      const shots = await evaluate('window.__mockup.shots()');
      const errors = [...(await evaluate('window.__mockup.errors()')), ...pageErrors];
      return { errors, shots: shots.filter((s) => s.device === device) };
    },
    async shoot(job) {
      await viewport(job.size.width, job.size.minHeight, job.size.scale);
      const r = await evaluate(`window.__mockup.show(${JSON.stringify(job.screen)}, ${JSON.stringify(job.state)}, ${job.hl})`);
      const h = Math.min(Math.max(r.height, job.size.minHeight), 8000);
      await viewport(job.size.width, h, job.size.scale);
      await capture(job.out);
    },
    async sheets(dir) {
      await viewport(1440, 900, 1);
      const first = await evaluate('window.__mockup.sheet(0)');
      const files = [];
      for (let p = 0; p < first.pages; p++) {
        const r = await evaluate(`window.__mockup.sheet(${p})`);
        await viewport(1440, Math.min(Math.max(r.height, 400), 12000), 1);
        const file = path.join(dir, `sheet-${p + 1}.png`);
        await capture(file);
        files.push(file);
        await viewport(1440, 900, 1);
      }
      return files;
    },
    async close() {
      try { await send('Browser.close'); } catch { child.kill(); }
      await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
      fs.rmSync(profile, { recursive: true, force: true });
    }
  };
}

// ---- Fallback driver: one browser process per measurement and per image.
function runOnce(browser, flags, url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-shot-'));
  return new Promise((resolve, reject) => {
    execFile(browser, [...BASE_FLAGS, '--user-data-dir=' + profile, '--virtual-time-budget=2000', ...flags, url], { maxBuffer: 64 * 1024 * 1024, timeout: 60000 }, (err, stdout) => {
      fs.rmSync(profile, { recursive: true, force: true });
      if (err) reject(err); else resolve(stdout);
    });
  });
}
function legacyDriver(browser) {
  let url = null;
  return {
    kind: 'legacy',
    async load(u) { url = u; },
    async measure(device) {
      const dom = await runOnce(browser, [`--window-size=${SIZE[device].width},${SIZE[device].minHeight}`, '--dump-dom'], url + '#measure=1');
      const m = dom.match(/<script type="application\/json" id="m-measure">([\s\S]*?)<\/script>/);
      if (!m) throw new Error('the runtime did not finish (no measurements). Open the file in a browser and check the console.');
      const part = JSON.parse(m[1]);
      return { errors: part.errors, shots: part.shots.filter((s) => s.device === device) };
    },
    async shoot(job) {
      const h = Math.min(Math.max(job.height, job.size.minHeight), 8000);
      const hash = `#s=${job.screen}&st=${job.state}&bare=1${job.hl ? '&hl=1' : ''}`;
      await runOnce(browser, [`--window-size=${job.size.width},${h}`, `--force-device-scale-factor=${job.size.scale}`, `--screenshot=${job.out}`], url + hash);
    },
    async sheets() { return []; },
    async close() {}
  };
}

const result = { errors: [], warnings: [], shots: [], sheets: [] };
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
  const started = Date.now();
  const M = JSON.parse(fs.readFileSync(path.join(o.dir, 'screens.json'), 'utf8'));
  // The overview page is always captured at desktop width, so desktop is always measured.
  const devices = [...new Set(['desktop', ...M.screens.map((s) => ((s.device || M.device) === 'mobile' ? 'mobile' : 'desktop'))])];
  let failed = false;
  let driver;
  try {
    if (process.env.MOCKUP_SLOW_CAPTURE === '1') throw new Error('MOCKUP_SLOW_CAPTURE=1');
    driver = await cdpDriver(browser);
  }
  catch (e) { out(`WARNING   Fast capture unavailable (${e.message}); using one browser process per image, which is slower.`); driver = legacyDriver(browser); }

  try {
    // Mockup first, so the review sheets show the real colors.
    for (const f of o.fidelity === 'both' ? ['mockup', 'wireframe'] : [o.fidelity]) {
      const file = path.join(o.dir, 'dist', f + '.html');
      if (!fs.existsSync(file)) { out(`ERROR     ${file} does not exist. Run build.mjs first.`); failed = true; continue; }
      await driver.load(pathToFileURL(file).href);

      // Measure once per device type, because height depends on the window width.
      const res = { errors: [], shots: [] };
      try {
        for (const d of devices) {
          const part = await driver.measure(d);
          for (const e of part.errors) if (!res.errors.includes(e)) res.errors.push(e);
          res.shots.push(...part.shots);
        }
      } catch (e) { out(`ERROR     ${f}: ${e.message}`); failed = true; continue; }
      const orderOf = { overview: -1, ...Object.fromEntries(M.screens.map((s, i) => [s.id, i])) };
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

      // Review sheets are made from the first fidelity only; they are for the author, not an output.
      if (o.sheetDir && !result.sheets.length) {
        fs.rmSync(o.sheetDir, { recursive: true, force: true });
        fs.mkdirSync(o.sheetDir, { recursive: true });
        const files = await driver.sheets(o.sheetDir);
        result.sheets = files;
        if (files.length) out(`Review sheets (${files.length}): ` + files.join(', '));
      }
      if (o.verifyOnly) continue;

      const outDir = path.join(o.pngDir || path.join(o.dir, 'dist', 'png'), f);
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.mkdirSync(outDir, { recursive: true });
      const jobs = [];
      let n = 0;
      res.shots.forEach((s) => {
        if (s.screen !== 'overview') n += 1;
        if (o.only && s.screen !== o.only) return;
        const name = s.screen === 'overview' ? '00-overview' : `${String(n).padStart(2, '0')}-${s.screen}--${s.state}`;
        const base = { size: SIZE[s.device], height: s.height, screen: s.screen, state: s.state };
        jobs.push({ ...base, out: path.join(outDir, name + '.png'), hl: false });
        if (o.highlight && s.newMarks > 0) jobs.push({ ...base, out: path.join(outDir, name + '--new.png'), hl: true });
      });
      for (const j of jobs) {
        try { await driver.shoot(j); } catch (e) { out(`ERROR     Could not capture ${j.out}: ${e.message}`); failed = true; continue; }
        if (!fs.existsSync(j.out)) { out(`ERROR     Could not capture ${j.out}`); failed = true; }
      }
      for (const j of jobs) result.shots.push({ fidelity: f, screen: j.screen, state: j.state, highlight: j.hl, file: path.relative(o.dir, j.out).split(path.sep).join('/') });
      out(`${f}: captured ${jobs.length} image(s) into ${outDir}`);
    }
  } finally {
    await driver.close();
  }
  out(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s (${driver.kind} capture)`);
  fs.mkdirSync(path.join(o.dir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(o.dir, 'dist', 'shoot.json'), JSON.stringify(result, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('ERROR     ' + (e.stack || e)); process.exit(1); });
}
