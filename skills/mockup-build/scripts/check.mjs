#!/usr/bin/env node
// Static check of a mockup folder: the manifest matches the fragments, every link has a target,
// no external resources, every screen traces back to the spec, no signs of sloppy output.
// Usage: node check.mjs <feature-dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLOP_PHRASES = [
  'liền mạch', 'nâng tầm', 'đột phá', 'trải nghiệm tuyệt vời', 'chào mừng trở lại', 'mạnh mẽ và linh hoạt',
  'seamless', 'supercharge', 'unlock the power', 'effortless', 'welcome back', 'next-level', 'game-changing',
  'シームレス', '次世代の'
];
// Standard state names and common synonyms. Standard names keep every mockup readable the same way.
export const STANDARD_STATES = ['default', 'empty', 'loading', 'error', 'validation-error', 'no-permission', 'disabled', 'confirm', 'success'];
const STATE_SYNONYMS = {
  'no-data': 'empty', 'blank': 'empty', 'empty-state': 'empty', 'no-result': 'empty', 'no-results': 'empty',
  'fetching': 'loading', 'spinner': 'loading', 'skeleton': 'loading', 'pending': 'loading', 'loading-state': 'loading',
  'err': 'error', 'failed': 'error', 'failure': 'error', 'server-error': 'error', 'error-state': 'error',
  'invalid': 'validation-error', 'form-error': 'validation-error', 'required-error': 'validation-error',
  'forbidden': 'no-permission', 'unauthorized': 'no-permission', 'denied': 'no-permission',
  'confirmation': 'confirm', 'confirm-dialog': 'confirm', 'done': 'success', 'saved': 'success', 'completed': 'success',
  'normal': 'default', 'initial': 'default', 'base': 'default'
};
const PLACEHOLDER = [/lorem ipsum/i, /dolor sit amet/i];
const WEAK_DATA = [/\b(User|Item|Product|Test|Sample|Name)\s?\d+\b/, /\bJohn Doe\b/i, /Nguyễn Văn A\b/];

function attrValues(html, name) {
  const out = [];
  const re = new RegExp('\\b' + name + '="([^"]*)"', 'g');
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// Output selection: which fidelity (mockup, wireframe), which format (html, png), and whether to add
// images that outline the new parts. No fidelity named means both; no format named means both.
export const ALL_OUTPUTS = { fidelity: ['mockup', 'wireframe'], formats: ['html', 'png'], highlight: true };
export function parseOutputs(text) {
  const tokens = String(text).split(/[\s,]+/).filter(Boolean).map((t) => t.toLowerCase());
  const bad = tokens.filter((t) => !['mockup', 'wireframe', 'html', 'png', 'highlight', 'all'].includes(t));
  if (bad.length) throw new Error(`Unknown --outputs value: ${bad.join(', ')}. Use: mockup, wireframe, html, png, highlight, all`);
  if (tokens.includes('all')) return { ...ALL_OUTPUTS };
  const fidelity = ALL_OUTPUTS.fidelity.filter((t) => tokens.includes(t));
  const formats = ALL_OUTPUTS.formats.filter((t) => tokens.includes(t));
  const out = { fidelity: fidelity.length ? fidelity : [...ALL_OUTPUTS.fidelity], formats: formats.length ? formats : [...ALL_OUTPUTS.formats], highlight: tokens.includes('highlight') };
  if (out.highlight && !out.formats.includes('png')) out.formats.push('png');
  return out;
}
export const outputsText = (o) => [...o.fidelity, ...o.formats, ...(o.highlight ? ['highlight'] : [])].join(', ');

// Read a fragment and replace <!--#include name--> with the content of screens/_partials/name.html
// (app chrome repeated across screens: sidebar, top bar).
export function loadFragment(dir, id, onError = () => {}) {
  const html = fs.readFileSync(path.join(dir, 'screens', id + '.html'), 'utf8');
  return html.replace(/<!--\s*#include\s+([a-z0-9-]+)\s*-->/g, (m, name) => {
    const p = path.join(dir, 'screens', '_partials', name + '.html');
    if (!fs.existsSync(p)) { onError(`screens/${id}.html: include "${name}" has no file screens/_partials/${name}.html`); return ''; }
    return fs.readFileSync(p, 'utf8');
  });
}

export function checkFeature(dir) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  const manifestPath = path.join(dir, 'screens.json');
  if (!fs.existsSync(manifestPath)) return { errors: ['No screens.json in ' + dir], warnings, manifest: null };
  let M;
  try { M = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return { errors: ['screens.json is not valid JSON: ' + e.message], warnings, manifest: null }; }

  for (const k of ['feature', 'slug', 'mode', 'device', 'lang', 'flows', 'screens', 'specRefs', 'assumptions']) {
    if (M[k] === undefined) E(`screens.json is missing the "${k}" field`);
  }
  if (errors.length) return { errors, warnings, manifest: M };
  if (!['new-product', 'existing-app'].includes(M.mode)) E('mode must be "new-product" or "existing-app"');
  if (!['desktop', 'mobile'].includes(M.device)) E('device must be "desktop" or "mobile"');
  if (!Array.isArray(M.sources) || !M.sources.length) E('sources must list at least one plan/spec file that was read');
  if (!['vi', 'en', 'ja'].includes(M.lang)) E('lang must be "vi", "en" or "ja"');
  if (M.slug !== path.basename(dir)) E(`slug "${M.slug}" must equal the folder name "${path.basename(dir)}"`);

  // inputs.json is the shared starting point: slug, mode and the source list must agree with it.
  const inputsPath = path.join(dir, 'inputs.json');
  let inputs = null;
  if (!fs.existsSync(inputsPath)) E('inputs.json is missing. Run inputs.mjs with the input files first.');
  else {
    try { inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8')); } catch (e) { E('inputs.json is not valid JSON: ' + e.message); }
  }
  if (inputs) {
    if (inputs.slug !== M.slug) E(`slug in screens.json ("${M.slug}") differs from inputs.json ("${inputs.slug}")`);
    if (inputs.mode !== M.mode) E(`mode in screens.json ("${M.mode}") differs from inputs.json ("${inputs.mode}"). Change the mode with inputs.mjs --mode.`);
    const known = new Set(inputs.inputs.map((x) => x.path));
    for (const src of M.sources) if (!known.has(src)) E(`sources lists "${src}" but that file is not in inputs.json. Add it with: inputs.mjs --dir <feature-dir> ${src}`);
    if (!M.sources.includes(inputs.primary)) E(`sources must include the primary document "${inputs.primary}"`);
  }

  const icons = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'assets', 'icons.json'), 'utf8'));
  const themePath = path.join(dir, 'theme.json');
  let theme = {};
  if (fs.existsSync(themePath)) {
    try { theme = JSON.parse(fs.readFileSync(themePath, 'utf8')); }
    catch (e) { E('theme.json is not valid JSON: ' + e.message); }
    if (M.mode === 'existing-app') {
      for (const t of ['c-bg', 'c-surface', 'c-border', 'c-text', 'c-text-muted', 'c-primary', 'font']) {
        if (!(theme.tokens || {})[t]) E(`theme.json is missing a required token: ${t}`);
      }
    } else if (Object.keys(theme.tokens || {}).length || fs.existsSync(path.join(dir, 'custom.css'))) {
      W('mode "new-product" should keep the neutral kit: remove the tokens in theme.json and custom.css unless the user asked for specific colors.');
    }
    if (!theme.source) E('theme.json is missing "source" (where the look was taken from)');
  } else {
    E(M.mode === 'existing-app' ? 'theme.json is missing (run the ui-context skill first)' : 'theme.json is missing (inputs.mjs creates it for new-product)');
  }

  const refIds = new Set(M.specRefs.map((r) => r.id));
  const assumeIds = new Set(M.assumptions.map((a) => a.id));
  // Ids look like R1, A1, Q1 and increase. A rerun keeps old ids and new items take the next number, so gaps are allowed.
  const seq = (list, prefix, label) => {
    let last = 0;
    for (const x of list) {
      const m = String(x.id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
      if (!m) { E(`${label}: id must look like ${prefix}<number> (got ${JSON.stringify(x.id)})`); continue; }
      if (+m[1] <= last) E(`${label}: ids must increase and be unique (problem at ${x.id})`);
      last = +m[1];
    }
  };
  seq(M.specRefs, 'R', 'specRefs'); seq(M.assumptions, 'A', 'assumptions'); seq(M.openQuestions || [], 'Q', 'openQuestions');
  for (const r of M.specRefs) {
    if (!r.id || !r.text || !r.source) E(`specRefs: every item needs id, text, source (problem at ${JSON.stringify(r.id)})`);
  }
  for (const a of M.assumptions) if (!a.id || !a.text) E(`assumptions: every item needs id and text (problem at ${JSON.stringify(a.id)})`);

  const screenIds = new Set();
  const stateIds = {};
  for (const s of M.screens) {
    if (!ID.test(s.id || '')) E(`Invalid screen id (lowercase letters, digits and hyphens only): ${JSON.stringify(s.id)}`);
    if (screenIds.has(s.id)) E(`Duplicate screen id: ${s.id}`);
    screenIds.add(s.id);
    if (!s.name) E(`Screen ${s.id} is missing name`);
    if (typeof s.existing !== 'boolean') E(`Screen ${s.id} is missing existing (true/false)`);
    if (!Array.isArray(s.states) || !s.states.length) { E(`Screen ${s.id} needs at least one state`); stateIds[s.id] = new Set(); continue; }
    stateIds[s.id] = new Set(s.states.map((x) => x.id));
    for (const x of s.states) {
      if (!ID.test(x.id || '')) E(`Screen ${s.id}: invalid state id: ${JSON.stringify(x.id)}`);
      if (!x.name) E(`Screen ${s.id}: state ${x.id} is missing name`);
      if (STATE_SYNONYMS[x.id]) E(`Screen ${s.id}: state "${x.id}" must use the standard name "${STATE_SYNONYMS[x.id]}"`);
    }
    if (s.device !== undefined && !['desktop', 'mobile'].includes(s.device)) E(`Screen ${s.id}: device must be "desktop" or "mobile"`);
    if (!s.purpose) E(`Screen ${s.id} is missing purpose`);
    if (s.states.length === 1 && !s.singleStateReason) {
      W(`Screen ${s.id} has a single state. Add empty/loading/error/no-permission states where they apply, or set singleStateReason.`);
    }
    const sr = s.specRefs || [], sa = s.assumptions || [];
    if (!sr.length && !sa.length) E(`Screen ${s.id} is not tied to any spec requirement or assumption (a sign it was invented)`);
    for (const id of sr) if (!refIds.has(id)) E(`Screen ${s.id} references an unknown specRef: ${id}`);
    for (const id of sa) if (!assumeIds.has(id)) E(`Screen ${s.id} references an unknown assumption: ${id}`);
  }
  if (M.mode === 'new-product' && M.screens.some((s) => s.existing)) E('mode "new-product" cannot have a screen with existing: true');

  const inFlow = new Set();
  for (const f of M.flows) {
    if (!f.id || !f.name || !Array.isArray(f.screens)) { E('Every flow needs id, name, screens'); continue; }
    for (const id of f.screens) { if (!screenIds.has(id)) E(`Flow ${f.id} references an unknown screen: ${id}`); inFlow.add(id); }
  }
  for (const id of screenIds) if (!inFlow.has(id)) W(`Screen ${id} is not part of any flow`);

  // Fragment
  const fragDir = path.join(dir, 'screens');
  const files = fs.existsSync(fragDir) ? fs.readdirSync(fragDir).filter((f) => f.endsWith('.html')) : [];
  for (const f of files) if (!screenIds.has(f.replace(/\.html$/, ''))) W(`Extra fragment that is not in screens.json: screens/${f}`);

  let newMarks = 0;
  const usedRefs = new Set(), usedAssumes = new Set();
  const fragments = {};
  for (const s of M.screens) {
    const file = path.join(fragDir, s.id + '.html');
    if (!fs.existsSync(file)) { E(`Missing fragment: screens/${s.id}.html`); continue; }
    const html = loadFragment(dir, s.id, E);
    fragments[s.id] = html;
    const at = `screens/${s.id}.html`;

    if (/<script\b/i.test(html)) E(`${at}: must not contain <script>. Use data-goto, data-set-state, data-open, data-close, data-toggle.`);
    if (/<(link|iframe|template|html|head|body)\b/i.test(html)) E(`${at}: must not contain <link>, <iframe>, <template>, <html>, <head>, <body>`);
    if (/\bon[a-z]+\s*=\s*["']/i.test(html)) E(`${at}: inline event attributes (onclick...) are not allowed`);
    if (/(src|href|action|poster)\s*=\s*["']\s*(https?:)?\/\//i.test(html) || /url\(\s*["']?\s*(https?:)?\/\//i.test(html) || /@import/i.test(html)) {
      E(`${at}: references an external resource (http/https). The mockup file must be self-contained.`);
    }
    if (/position\s*:\s*fixed/i.test(html)) E(`${at}: position: fixed is not allowed (it breaks the viewer and the screenshots). Use .m-modal/.m-drawer/.m-toast.`);
    if (/\bdata-[a-z-]+\s*=\s*'/.test(html)) E(`${at}: data-* attributes must use double quotes`);

    const used = new Set(attrValues(html, 'data-state').flatMap((v) => v.split(/\s+/).filter(Boolean)));
    for (const v of used) if (!stateIds[s.id].has(v)) E(`${at}: data-state="${v}" is not declared in screens.json`);
    if (s.states.length > 1) for (const v of stateIds[s.id]) if (!used.has(v)) E(`${at}: state "${v}" is in screens.json but no element carries data-state="${v}"`);

    for (const v of attrValues(html, 'data-goto')) {
      const [sc, stt] = v.split('#');
      if (!screenIds.has(sc)) E(`${at}: data-goto="${v}" points to an unknown screen`);
      else if (stt && !stateIds[sc].has(stt)) E(`${at}: data-goto="${v}" points to an unknown state`);
    }
    for (const v of attrValues(html, 'data-set-state')) if (!stateIds[s.id].has(v)) E(`${at}: data-set-state="${v}" is not a state of this screen`);
    const ids = new Set(attrValues(html, 'id'));
    for (const name of ['data-open', 'data-toggle', 'data-close']) {
      for (const v of attrValues(html, name)) if (v && !ids.has(v)) E(`${at}: ${name}="${v}" has no element with id="${v}" in the fragment`);
    }
    for (const v of attrValues(html, 'data-icon')) if (!icons[v]) E(`${at}: data-icon="${v}" is not in the icon set (see assets/icons.json)`);
    for (const v of attrValues(html, 'data-spec').flatMap((x) => x.split(/[\s,]+/).filter(Boolean))) {
      usedRefs.add(v);
      if (!refIds.has(v)) E(`${at}: data-spec="${v}" is not in specRefs`);
      else if (!(s.specRefs || []).includes(v)) E(`${at}: data-spec="${v}" is not listed in the specRefs of screen ${s.id}`);
    }
    for (const v of attrValues(html, 'data-assume').flatMap((x) => x.split(/[\s,]+/).filter(Boolean))) {
      usedAssumes.add(v);
      if (!assumeIds.has(v)) E(`${at}: data-assume="${v}" is not in assumptions`);
      else if (!(s.assumptions || []).includes(v)) E(`${at}: data-assume="${v}" is not listed in the assumptions of screen ${s.id}`);
    }
    const marks = (html.match(/\bdata-new\b/g) || []).length;
    newMarks += marks;
    if (!s.existing && marks) W(`${at}: a brand-new screen does not need data-new (the whole screen already counts as new)`);
    if (!/\bdata-(spec|assume)=/.test(html)) W(`${at}: no element carries data-spec or data-assume, so viewers cannot trace it back to the spec`);

    const text = html.replace(/<[^>]+>/g, ' ');
    for (const re of PLACEHOLDER) if (re.test(text)) E(`${at}: contains placeholder text (${re.source}). Use data that fits the domain in the spec.`);
    for (const re of WEAK_DATA) { const m = text.match(re); if (m) W(`${at}: meaningless sample data "${m[0]}". Use names, codes and figures that fit the domain.`); }
    for (const p of SLOP_PHRASES) if (text.toLowerCase().includes(p.toLowerCase())) W(`${at}: marketing-style wording "${p}". Use concrete, domain-specific labels.`);
    if (/(linear|radial|conic)-gradient/i.test(html)) W(`${at}: uses a gradient. Keep it only if the real app uses exactly this gradient.`);
    if (!theme.allowEmoji) {
      const emoji = text.match(/[\u{1F000}-\u{1FAFF}]/u);
      if (emoji) E(`${at}: uses the emoji "${emoji[0]}" as an icon. Use <i data-icon="..."></i>, or set "allowEmoji": true in theme.json if the real app uses emoji.`);
    }
    if (Buffer.byteLength(html) > 80 * 1024) W(`${at}: fragment is larger than 80KB, consider splitting the screen`);
  }

  if (M.mode === 'existing-app') {
    if (!M.screens.some((s) => s.existing)) W('mode is "existing-app" but no screen has existing: true. If the feature attaches to an existing screen, show that screen.');
    for (const s of M.screens) {
      if (s.existing && fragments[s.id] && !/\bdata-new\b/.test(fragments[s.id]) && !s.unchangedReason) {
        W(`Existing screen ${s.id} has no data-new element. Mark what was added, or set unchangedReason if the screen is only there to lead into the flow.`);
      }
    }
    if (!newMarks && !M.screens.some((s) => !s.existing)) E('Nothing is marked as new (data-new) and there is no new screen. The mockup does not show where the feature is added.');
  }
  for (const id of refIds) if (!M.screens.some((s) => (s.specRefs || []).includes(id))) W(`specRef ${id} is not shown on any screen. Remove it from specRefs if it is not about the UI.`);
  for (const id of assumeIds) if (!M.screens.some((s) => (s.assumptions || []).includes(id))) W(`assumption ${id} is not attached to any screen`);

  const customPath = path.join(dir, 'custom.css');
  if (fs.existsSync(customPath)) {
    const css = fs.readFileSync(customPath, 'utf8');
    if (/@import|url\(\s*["']?\s*(https?:)?\/\//i.test(css)) E('custom.css: references an external resource');
    if (/position\s*:\s*fixed/i.test(css)) E('custom.css: position: fixed is not allowed');
  }

  return { errors, warnings, manifest: M, theme };
}

function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node check.mjs <feature-dir>'); process.exit(2); }
  const { errors, warnings } = checkFeature(path.resolve(dir));
  for (const w of warnings) console.log('WARNING   ' + w);
  for (const e of errors) console.log('ERROR     ' + e);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
