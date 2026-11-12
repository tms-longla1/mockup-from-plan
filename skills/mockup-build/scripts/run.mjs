#!/usr/bin/env node
// One command for the final stage: check → build → open in a browser and capture images → write the report.
// Every mockup folder goes through this command, so the output always has the same structure whatever the input was.
// Usage:  node run.mjs <feature-dir> [--outputs mockup,wireframe,html,png,highlight] [--open]
//         --open opens the result in the default browser when the run passes.
//         Without --outputs the selection in inputs.json applies; if inputs.json has none, everything is produced.
// Writes: dist/wireframe.html, dist/mockup.html, dist/png/, dist/report.json, REPORT.md, ../index.html
// Exit code: 0 pass, 1 errors, 3 built but no browser available for the visual check.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import { checkFeature, parseOutputs, outputsText, ALL_OUTPUTS } from './check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = {
  vi: { pass: 'ĐẠT', fail: 'CÓ LỖI', unverified: 'CHƯA KIỂM TRA BẰNG ẢNH', status: 'Trạng thái', mode: 'Chế độ', outputs: 'Kết quả', inputs: 'Đầu vào', role: 'Vai trò', type: 'Loại', file: 'File', screens: 'Màn hình', screen: 'Màn hình', kind: 'Loại', isNew: 'Mới', existing: 'Đã có', device: 'Thiết bị', states: 'Trạng thái', refs: 'Yêu cầu', reqs: 'Yêu cầu trong spec', source: 'Nguồn', shownOn: 'Thể hiện ở', assumptions: 'Giả định', questions: 'Câu hỏi mở', checks: 'Tự kiểm tra', errors: 'Lỗi', warnings: 'Cảnh báo', none: 'Không có', images: 'Ảnh', note: 'Bản minh họa sinh từ plan/spec để hình dung tính năng. Không phải thiết kế cuối cùng.' },
  en: { pass: 'PASS', fail: 'FAILED', unverified: 'NOT VERIFIED IN BROWSER', status: 'Status', mode: 'Mode', outputs: 'Outputs', inputs: 'Inputs', role: 'Role', type: 'Type', file: 'File', screens: 'Screens', screen: 'Screen', kind: 'Kind', isNew: 'New', existing: 'Existing', device: 'Device', states: 'States', refs: 'Requirements', reqs: 'Spec requirements', source: 'Source', shownOn: 'Shown on', assumptions: 'Assumptions', questions: 'Open questions', checks: 'Self-check', errors: 'Errors', warnings: 'Warnings', none: 'None', images: 'Images', note: 'Illustration generated from the plan/spec. Not a final design.' },
  ja: { pass: '合格', fail: 'エラーあり', unverified: '画像での確認未実施', status: 'ステータス', mode: 'モード', outputs: '成果物', inputs: '入力', role: '役割', type: '種別', file: 'ファイル', screens: '画面', screen: '画面', kind: '区分', isNew: '新規', existing: '既存', device: 'デバイス', states: '状態', refs: '要件', reqs: '仕様の要件', source: '出典', shownOn: '該当画面', assumptions: '仮定', questions: '未決事項', checks: 'セルフチェック', errors: 'エラー', warnings: '警告', none: 'なし', images: '画像', note: 'プラン・仕様から生成したイメージです。最終デザインではありません。' }
};
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function node(script, args) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function writeReport(dir, M, inputs, data) {
  const t = L[M.lang] || L.en;
  const label = { pass: t.pass, fail: t.fail, unverified: t.unverified }[data.status];
  const lines = [];
  const p = (s = '') => lines.push(s);
  p(`# ${M.feature}`); p();
  p(`> ${t.note}`); p();
  p(`- **${t.status}**: ${label}`);
  p(`- **${t.mode}**: ${M.mode}`); p();
  p(`## ${t.outputs}`); p();
  for (const f of data.outputs) p(`- [${f}](${f})`);
  if (!data.outputs.length) p(t.none);
  p();
  p(`## ${t.inputs}`); p();
  p(`| ${t.role} | ${t.type} | ${t.file} |`); p('|---|---|---|');
  // UI sources with many files are grouped by folder to keep the table short.
  const groups = new Map();
  for (const x of (inputs ? inputs.inputs : []).filter((i) => i.role !== 'ignored')) {
    const key = x.role === 'ui-source' && x.type !== 'source-code' ? `${x.role}|${x.type}|${path.posix.dirname(x.path)}/` : `${x.role}|${x.type}|${x.path}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  for (const [key, n] of groups) { const [role, type, file] = key.split('|'); p(`| ${role} | ${type} | ${cell(file)}${n > 1 ? ` (${n})` : ''} |`); }
  p();
  p(`## ${t.screens}`); p();
  p(`| # | ${t.screen} | ${t.kind} | ${t.device} | ${t.states} | ${t.refs} |`); p('|---|---|---|---|---|---|');
  M.screens.forEach((s, i) => p(`| ${i + 1} | ${cell(s.name)} (\`${s.id}\`) | ${s.existing ? t.existing : t.isNew} | ${s.device || M.device} | ${cell(s.states.map((x) => x.name).join('; '))} | ${[...(s.specRefs || []), ...(s.assumptions || [])].join(', ')} |`));
  p();
  p(`## ${t.reqs}`); p();
  p(`| Id | ${t.refs} | ${t.source} | ${t.shownOn} |`); p('|---|---|---|---|');
  for (const r of M.specRefs) p(`| ${r.id} | ${cell(r.text)} | ${cell(r.source)} | ${M.screens.filter((s) => (s.specRefs || []).includes(r.id)).map((s) => '`' + s.id + '`').join(', ')} |`);
  p();
  p(`## ${t.assumptions}`); p();
  if (!M.assumptions.length) p(t.none);
  for (const a of M.assumptions) p(`- **${a.id}** ${a.text}`);
  p();
  p(`## ${t.questions}`); p();
  if (!(M.openQuestions || []).length) p(t.none);
  for (const q of M.openQuestions || []) p(`- **${q.id}** ${q.text}`);
  p();
  p(`## ${t.checks}`); p();
  p(`- ${t.errors}: ${data.errors.length}`);
  for (const e of data.errors) p(`  - ${e}`);
  p(`- ${t.warnings}: ${data.warnings.length}`);
  for (const w of data.warnings) p(`  - ${w}`);
  p();
  p(`## ${t.images}`); p();
  const shots = data.shots.filter((s) => s.fidelity === data.selection.fidelity[0]);
  if (!shots.length) p(t.none);
  for (const s of M.screens) {
    const mine = shots.filter((x) => x.screen === s.id);
    if (!mine.length) continue;
    p(`### ${s.name}`); p();
    for (const x of mine) { const st = s.states.find((y) => y.id === x.state); p(`- [${st ? st.name : x.state}${x.highlight ? ' — ' + t.isNew : ''}](${x.file})`); }
    p();
  }
  fs.writeFileSync(path.join(dir, 'REPORT.md'), lines.join('\n').replace(/\n+$/, '\n'));
}

function writeIndex(root) {
  const rows = [];
  for (const name of fs.readdirSync(root).sort()) {
    const rep = path.join(root, name, 'dist', 'report.json');
    if (!fs.existsSync(rep)) continue;
    const r = JSON.parse(fs.readFileSync(rep, 'utf8'));
    const link = (f, text) => (r.outputs.includes(f) ? `<a href="${esc(name)}/${f}">${text}</a>` : '');
    rows.push(`<tr><td>${esc(r.feature)}<br><small>${esc(name)}</small></td><td>${esc(r.mode)}</td><td>${r.screens}</td><td class="s-${r.status}">${esc(r.status)}</td><td>${link('dist/mockup.html', 'mockup')} ${link('dist/wireframe.html', 'wireframe')} <a href="${esc(name)}/REPORT.md">report</a></td></tr>`);
  }
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mockups</title>
<style>
body { margin: 32px; font: 14px/1.5 -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", Arial, sans-serif; color: #1d2129; }
table { border-collapse: collapse; width: 100%; max-width: 1100px; }
th, td { padding: 8px 12px; border-bottom: 1px solid #d5d8dd; text-align: left; vertical-align: top; }
th { font-size: 12px; color: #667085; }
small { color: #667085; }
a { margin-right: 10px; }
.s-pass { color: #23794a; font-weight: 600; } .s-fail { color: #c0362c; font-weight: 600; } .s-unverified { color: #a86400; font-weight: 600; }
</style></head><body>
<h1>Mockups</h1>
<table><thead><tr><th>Feature</th><th>Mode</th><th>Screens</th><th>Status</th><th>Open</th></tr></thead><tbody>
${rows.join('\n')}
</tbody></table>
</body></html>
`;
  fs.writeFileSync(path.join(root, 'index.html'), html);
}

function main() {
  const argv = process.argv.slice(2);
  let cli = null;
  const openIdx = argv.indexOf('--open');
  const wantOpen = openIdx >= 0;
  if (wantOpen) argv.splice(openIdx, 1);
  const oi = argv.indexOf('--outputs');
  if (oi >= 0) { try { cli = parseOutputs(argv[oi + 1] || ''); } catch (e) { console.error(e.message); process.exit(2); } argv.splice(oi, 2); }
  const dir = argv[0] && path.resolve(argv[0]);
  if (!dir) { console.error('Usage: node run.mjs <feature-dir> [--outputs mockup,wireframe,html,png,highlight]'); process.exit(2); }

  const chk = checkFeature(dir);
  const M = chk.manifest;
  if (!M || !Array.isArray(M.screens) || !Array.isArray(M.specRefs) || !Array.isArray(M.assumptions)) {
    for (const e of chk.errors) console.log('ERROR     ' + e);
    console.log('\nscreens.json is not usable yet, so no report was written.');
    process.exit(1);
  }
  const inputsPath = path.join(dir, 'inputs.json');
  const inputs = fs.existsSync(inputsPath) ? JSON.parse(fs.readFileSync(inputsPath, 'utf8')) : null;
  const want = cli || (inputs && inputs.outputs) || { ...ALL_OUTPUTS };
  const wantPng = want.formats.includes('png');
  const wantHtml = want.formats.includes('html');
  const fidArg = want.fidelity.length === 2 ? 'both' : want.fidelity[0];
  const data = { status: 'pass', errors: [...chk.errors], warnings: [...chk.warnings], shots: [], outputs: [], selection: want };
  let code = 0;
  let reviewDir = null;
  const dist = path.join(dir, 'dist');
  // Clear the previous run so dist holds exactly what was selected.
  for (const f of ALL_OUTPUTS.fidelity) fs.rmSync(path.join(dist, f + '.html'), { force: true });
  fs.rmSync(path.join(dist, 'png'), { recursive: true, force: true });

  if (data.errors.length) { data.status = 'fail'; code = 1; }
  else {
    const b = node('build.mjs', [dir, '--fidelity', fidArg]);
    if (b.code !== 0) { data.status = 'fail'; code = 1; data.errors.push('build.mjs failed: ' + b.out.trim().split('\n').pop()); }
    else {
      // png not selected: still capture one set into a temp folder for the author to review; it is not an output.
      const shootArgs = [dir, '--fidelity', wantPng ? fidArg : want.fidelity[0]];
      if (wantPng && want.highlight) shootArgs.push('--highlight');
      if (!wantPng) { reviewDir = path.join(os.tmpdir(), 'mockup-review-' + M.slug); fs.rmSync(reviewDir, { recursive: true, force: true }); shootArgs.push('--png-dir', reviewDir); }
      const s = node('shoot.mjs', shootArgs);
      const sj = path.join(dir, 'dist', 'shoot.json');
      if (s.code === 3) { data.status = 'unverified'; code = 3; data.warnings.push('No browser found: runtime errors were not checked and no images were captured.'); fs.rmSync(sj, { force: true }); }
      else if (fs.existsSync(sj)) {
        const r = JSON.parse(fs.readFileSync(sj, 'utf8'));
        data.errors.push(...r.errors); data.warnings.push(...r.warnings); data.shots = wantPng ? r.shots : [];
        if (s.code !== 0 || r.errors.length) { data.status = 'fail'; code = 1; }
      } else { data.status = 'fail'; code = 1; data.errors.push('shoot.mjs failed: ' + s.out.trim().split('\n').pop()); }
    }
  }
  // Every screen/state combination must have an image in each selected fidelity.
  if (data.status === 'pass' && wantPng) {
    for (const f of want.fidelity) for (const sc of M.screens) for (const st of sc.states) {
      if (!data.shots.some((x) => x.fidelity === f && x.screen === sc.id && x.state === st.id && !x.highlight)) { data.errors.push(`Missing ${f} image: ${sc.id} / ${st.id}`); data.status = 'fail'; code = 1; }
    }
  }
  // HTML is always built for checking and capturing; when html is not selected it is removed afterwards.
  for (const f of want.fidelity) {
    const file = path.join(dist, f + '.html');
    if (!wantHtml) fs.rmSync(file, { force: true });
    else if (data.status !== 'fail' && fs.existsSync(file)) data.outputs.push(`dist/${f}.html`);
  }
  if (wantPng && data.status !== 'fail') for (const f of want.fidelity) if (fs.existsSync(path.join(dist, 'png', f))) data.outputs.push(`dist/png/${f}/`);

  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist', 'report.json'), JSON.stringify({
    feature: M.feature, slug: M.slug, mode: M.mode, status: data.status, screens: M.screens.length,
    states: M.screens.reduce((n, s) => n + s.states.length, 0), specRefs: M.specRefs.length, assumptions: M.assumptions.length,
    openQuestions: (M.openQuestions || []).length, selection: want, errors: data.errors, warnings: data.warnings, outputs: data.outputs, shots: data.shots
  }, null, 2) + '\n');
  writeReport(dir, M, inputs, data);
  writeIndex(path.dirname(dir));

  for (const w of data.warnings) console.log('WARNING   ' + w);
  for (const e of data.errors) console.log('ERROR     ' + e);
  console.log(`\nResult:  ${data.status.toUpperCase()} — ${M.screens.length} screen(s), ${data.shots.length} image(s), ${data.errors.length} error(s), ${data.warnings.length} warning(s)`);
  console.log('Outputs: ' + outputsText(want));
  if (reviewDir && data.status !== 'fail') console.log('Review images (temporary, not an output): ' + reviewDir);
  console.log('Report:  ' + path.join(dir, 'REPORT.md'));
  // Clickable links: most terminals open file:// URLs on click.
  const links = data.outputs.map((f) => pathToFileURL(path.join(dir, f)).href);
  for (const l of links) console.log('Open:    ' + l);
  const first = data.outputs.find((f) => f.endsWith('.html')) || data.outputs[0];
  if (wantOpen && first && data.status !== 'fail') {
    const target = path.join(dir, first);
    const cmd = process.platform === 'darwin' ? ['open', [target]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', target]] : ['xdg-open', [target]];
    try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); console.log('Opened:  ' + target); } catch { /* opening is a convenience only */ }
  }
  process.exit(code);
}

main();
