/* Runtime of the mockup file: overview page, screen navigation, state switching, marking the new parts,
   showing spec notes. Fragments must not contain scripts; every interaction goes through
   the data-* attributes handled here. */
(function () {
  'use strict';
  var root = document.documentElement;
  var errors = [];
  function fail(msg) {
    errors.push(String(msg));
    root.setAttribute('data-mockup-errors', JSON.stringify(errors));
    var bar = document.getElementById('v-error');
    if (bar) { bar.hidden = false; bar.textContent = errors.join(' | '); }
  }
  window.addEventListener('error', function (e) { fail(e.message || e); });

  var I18N = {
    vi: { wireframe: 'WIREFRAME', mockup: 'MOCKUP', showNew: 'Phần mới', showNotes: 'Chú thích', state: 'Trạng thái', isNew: 'MỚI', isExisting: 'Đã có', newScreen: 'Màn hình mới', existingScreen: 'Màn hình đã có', changedScreen: 'Màn hình đã có, có thay đổi', specRefs: 'Yêu cầu trong spec', assumptions: 'Giả định (spec không nói rõ)', questions: 'Câu hỏi mở', none: 'Không có', banner: 'Bản minh họa sinh từ plan/spec để hình dung tính năng. Không phải thiết kế cuối cùng.', overview: 'Tổng quan', modeExisting: 'Tính năng thêm vào app đã có', modeNew: 'Sản phẩm mới', nScreens: 'màn hình', nStates: 'trạng thái', nNew: 'mới', nChanged: 'có thay đổi', nUnchanged: 'không đổi', roadmap: 'Lộ trình màn hình', step: 'Bước', unchangedScreen: 'Không đổi, để dẫn luồng', changes: 'Tính năng thay đổi những gì', shownOn: 'Thể hiện ở', sources: 'Nguồn', howTo: 'Cách xem mockup', howToItems: ['Cột trái liệt kê các luồng và màn hình; bấm để chuyển màn hình.', 'Thanh trạng thái phía trên màn hình đổi giữa các trạng thái như rỗng, lỗi, sau khi lưu.', 'Nút "Phần mới" khoanh những gì tính năng thêm vào một màn hình đã có.', 'Nút "Chú thích" hiện mã yêu cầu (R) và giả định (A) ngay trên giao diện; chi tiết ở cột phải.', 'Các nút, ô chọn trong màn hình bấm thử được.'] },
    en: { wireframe: 'WIREFRAME', mockup: 'MOCKUP', showNew: 'New parts', showNotes: 'Notes', state: 'State', isNew: 'NEW', isExisting: 'Existing', newScreen: 'New screen', existingScreen: 'Existing screen', changedScreen: 'Existing screen with changes', specRefs: 'Spec requirements', assumptions: 'Assumptions (not stated in spec)', questions: 'Open questions', none: 'None', banner: 'Illustration generated from the plan/spec. Not a final design.', overview: 'Overview', modeExisting: 'Feature added to an existing app', modeNew: 'New product', nScreens: 'screens', nStates: 'states', nNew: 'new', nChanged: 'changed', nUnchanged: 'unchanged', roadmap: 'Screen roadmap', step: 'Step', unchangedScreen: 'Unchanged, leads into the flow', changes: 'What the feature changes', shownOn: 'Shown on', sources: 'Sources', howTo: 'How to read this mockup', howToItems: ['The left column lists the flows and screens; click to switch screens.', 'The state bar above the screen switches between states such as empty, error, after saving.', 'The "New parts" button outlines what the feature adds to an existing screen.', 'The "Notes" button shows requirement (R) and assumption (A) ids on the UI; details are in the right column.', 'Buttons and dropdowns on the screens can be clicked.'] },
    ja: { wireframe: 'ワイヤーフレーム', mockup: 'モックアップ', showNew: '追加箇所', showNotes: '注記', state: '状態', isNew: '新規', isExisting: '既存', newScreen: '新規画面', existingScreen: '既存画面', changedScreen: '既存画面（変更あり）', specRefs: '仕様の要件', assumptions: '仮定（仕様に記載なし）', questions: '未決事項', none: 'なし', banner: 'プラン・仕様から生成したイメージです。最終デザインではありません。', overview: '概要', modeExisting: '既存アプリへの機能追加', modeNew: '新規プロダクト', nScreens: '画面', nStates: '状態', nNew: '新規', nChanged: '変更あり', nUnchanged: '変更なし', roadmap: '画面ロードマップ', step: 'ステップ', unchangedScreen: '変更なし（導線として表示）', changes: 'この機能で変わること', shownOn: '該当画面', sources: '出典', howTo: 'モックアップの見方', howToItems: ['左の列にフローと画面が並びます。クリックで画面を切り替えます。', '画面上部の状態バーで、空・エラー・保存後などの状態を切り替えます。', '「追加箇所」ボタンで、既存画面に追加される部分を囲んで表示します。', '「注記」ボタンで、要件（R）と仮定（A）の番号を画面上に表示します。詳細は右の列にあります。', '画面内のボタンや選択欄はクリックして試せます。'] }
  };

  var M = JSON.parse(document.getElementById('m-manifest').textContent);
  var ICONS = JSON.parse(document.getElementById('m-icons').textContent);
  var T = I18N[M.lang] || I18N.en;
  var fidelity = root.getAttribute('data-fidelity');
  var screens = {};
  M.screens.forEach(function (s) { screens[s.id] = s; });
  var refs = {}, assumes = {};
  (M.specRefs || []).forEach(function (r) { refs[r.id] = r; });
  (M.assumptions || []).forEach(function (a) { assumes[a.id] = a; });
  var order = [];
  (M.flows || []).forEach(function (f) { f.screens.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); }); });
  M.screens.forEach(function (s) { if (order.indexOf(s.id) < 0) order.push(s.id); });

  // 'overview' is a page generated from the manifest, not a screen; it is the landing page.
  var OV = 'overview';
  var q = new URLSearchParams(location.hash.slice(1));
  var hasExisting = M.screens.some(function (s) { return s.existing; });
  var st = {
    screen: screens[q.get('s')] ? q.get('s') : OV,
    state: q.get('st'),
    bare: q.get('bare') === '1',
    hl: q.has('hl') ? q.get('hl') === '1' : (q.get('bare') === '1' ? false : hasExisting),
    notes: q.has('notes') ? q.get('notes') === '1' : q.get('bare') !== '1'
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function all(sel, base) { return Array.prototype.slice.call((base || document).querySelectorAll(sel)); }
  function visible(n) { return n.getClientRects().length > 0; }

  // ---- Viewer chrome
  var screenEl = el('div', { 'class': 'm-screen', id: 'm-screen' });
  var marksEl = el('div', { 'class': 'v-marks' });
  var canvas = el('div', { 'class': 'v-canvas' }, [screenEl, marksEl]);
  var frame = el('div', { 'class': 'v-frame v-frame--' + (M.device === 'mobile' ? 'mobile' : 'desktop') }, [canvas]);
  var ovEl = el('div', { 'class': 'v-ov', hidden: '' });
  var navEl = el('nav', { 'class': 'v-nav' });
  var stateBar = el('div', { 'class': 'v-statebar' });
  var notesEl = el('aside', { 'class': 'v-notes' });
  var btnNew = el('button', { 'class': 'v-toggle', type: 'button', text: T.showNew, on: { click: function () { st.hl = !st.hl; sync(); } } });
  var btnNotes = el('button', { 'class': 'v-toggle', type: 'button', text: T.showNotes, on: { click: function () { st.notes = !st.notes; sync(); } } });
  var app = el('div', { 'class': 'v-app' }, [
    el('header', { 'class': 'v-top' }, [
      el('span', { 'class': 'v-top__title', text: M.feature }),
      el('span', { 'class': 'v-top__tag', text: T[fidelity] || fidelity }),
      el('span', { 'class': 'v-top__spacer' }),
      hasExisting ? btnNew : null,
      btnNotes
    ]),
    navEl,
    el('main', { 'class': 'v-stage' }, [
      el('div', { 'class': 'v-error', id: 'v-error', hidden: '' }),
      el('div', { 'class': 'v-banner', text: T.banner }),
      stateBar,
      el('div', { 'class': 'v-scroll' }, [ovEl, frame])
    ]),
    notesEl
  ]);
  document.body.appendChild(app);

  function buildNav() {
    navEl.innerHTML = '';
    navEl.appendChild(el('button', {
      'class': 'v-nav__item v-nav__item--ov', type: 'button', 'data-screen': OV,
      'aria-current': String(st.screen === OV), on: { click: function () { go(OV); } }
    }, [el('span', { 'class': 'v-nav__num', text: '' }), el('span', { 'class': 'v-nav__name', text: T.overview })]));
    var n = 0;
    (M.flows || []).forEach(function (f) {
      navEl.appendChild(el('div', { 'class': 'v-nav__flow', text: f.name }));
      f.screens.forEach(function (id) {
        var s = screens[id];
        if (!s) return;
        n += 1;
        navEl.appendChild(el('button', {
          'class': 'v-nav__item', type: 'button', 'data-screen': id,
          'aria-current': String(id === st.screen),
          on: { click: function () { go(id); } }
        }, [
          el('span', { 'class': 'v-nav__num', text: String(n) }),
          el('span', { 'class': 'v-nav__name', text: s.name }),
          hasExisting ? el('span', { 'class': 'v-pill v-pill--' + (s.existing ? 'old' : 'new'), text: s.existing ? T.isExisting : T.isNew }) : null
        ]));
      });
    });
  }

  function buildStateBar() {
    var s = screens[st.screen];
    stateBar.innerHTML = '';
    stateBar.appendChild(el('span', { 'class': 'v-statebar__label', text: T.state }));
    s.states.forEach(function (x) {
      stateBar.appendChild(el('button', {
        'class': 'v-state', type: 'button', text: x.name || x.id,
        'aria-pressed': String(x.id === st.state),
        on: { click: function () { st.state = x.id; render(); } }
      }));
    });
  }

  function noteRow(kind, id, text, src) {
    return el('div', { 'class': 'v-note' }, [
      el('span', { 'class': 'v-note__id v-note__id--' + kind, text: id }),
      el('span', {}, [document.createTextNode(text || ''), src ? el('span', { 'class': 'v-note__src', text: src }) : null])
    ]);
  }
  function buildNotes() {
    var s = screens[st.screen];
    notesEl.innerHTML = '';
    notesEl.appendChild(el('h2', { text: s.name }));
    var kind = !s.existing ? T.newScreen : (screenEl.querySelector('[data-new]') ? T.changedScreen : T.existingScreen);
    if (hasExisting) notesEl.appendChild(el('p', {}, [el('span', { 'class': 'v-pill v-pill--' + (s.existing ? 'old' : 'new'), text: kind })]));
    if (s.purpose) notesEl.appendChild(el('p', { text: s.purpose }));
    notesEl.appendChild(el('h3', { text: T.specRefs }));
    if (!(s.specRefs || []).length) notesEl.appendChild(el('p', { text: T.none }));
    (s.specRefs || []).forEach(function (id) { var r = refs[id] || {}; notesEl.appendChild(noteRow('spec', id, r.text, r.source)); });
    notesEl.appendChild(el('h3', { text: T.assumptions }));
    if (!(s.assumptions || []).length) notesEl.appendChild(el('p', { text: T.none }));
    (s.assumptions || []).forEach(function (id) { var a = assumes[id] || {}; notesEl.appendChild(noteRow('assume', id, a.text)); });
    var qs = (M.openQuestions || []).filter(function (x) { return !x.screens || x.screens.indexOf(s.id) >= 0; });
    if (qs.length) {
      notesEl.appendChild(el('h3', { text: T.questions }));
      qs.forEach(function (x) { notesEl.appendChild(noteRow('question', x.id, x.text)); });
    }
  }

  // ---- Screen
  function applyIcons(base) {
    all('[data-icon]', base || screenEl).forEach(function (n) {
      var body = ICONS[n.getAttribute('data-icon')];
      if (!body) { fail('Unknown icon: ' + n.getAttribute('data-icon')); return; }
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
    });
  }
  function applyState(base, state) {
    var want = state || st.state;
    all('[data-state]', base || screenEl).forEach(function (n) {
      n.hidden = n.getAttribute('data-state').split(/\s+/).indexOf(want) < 0;
    });
  }
  // Marks (NEW, R.., A..) live in one overlay layer inside the canvas, positioned in canvas-content
  // coordinates. Each marked element gets one group of chips at its top-left corner; groups that would
  // collide are moved aside. Elements inside a scrolled-away part of an inner scroll area get no mark,
  // and every scroll inside the canvas redraws the layer, so marks stay on their element.
  function clipOf(n) {
    var c = canvas.getBoundingClientRect();
    var box = { left: c.left, top: c.top, right: c.right, bottom: c.bottom };
    for (var p = n.parentElement; p && p !== canvas; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        var r = p.getBoundingClientRect();
        box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) };
      }
    }
    return box;
  }
  function drawMarks() {
    marksEl.innerHTML = '';
    // Collapse the layer first, so its old size does not keep the canvas scroll area large.
    marksEl.style.width = '0';
    marksEl.style.height = '0';
    if (!st.hl && !st.notes) return;
    var base = canvas.getBoundingClientRect();
    var sx = canvas.scrollLeft, sy = canvas.scrollTop;
    var width = canvas.scrollWidth;
    marksEl.style.width = width + 'px';
    marksEl.style.height = canvas.scrollHeight + 'px';
    var placed = [];
    var hit = function (x, y, w, h) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (x < p.x + p.w + 3 && x + w + 3 > p.x && y < p.y + p.h + 1 && y + h + 1 > p.y) return p;
      }
      return null;
    };
    all('[data-new],[data-spec],[data-assume]', screenEl).filter(visible).forEach(function (n) {
      var chips = [];
      if (st.hl && n.hasAttribute('data-new')) chips.push(['new', T.isNew]);
      if (st.notes && n.hasAttribute('data-spec')) chips.push(['spec', n.getAttribute('data-spec')]);
      if (st.notes && n.hasAttribute('data-assume')) chips.push(['assume', n.getAttribute('data-assume')]);
      if (!chips.length) return;
      var r = n.getBoundingClientRect();
      var c = clipOf(n);
      // The element's top-left corner must be inside every scroll area around it.
      var ax = Math.max(r.left, c.left), ay = Math.max(r.top, c.top);
      if (r.right < c.left || r.left > c.right || r.bottom < c.top || r.top > c.bottom || ay > Math.min(r.bottom, c.bottom) - 4) return;
      var group = el('span', { 'class': 'v-markgroup' }, chips.map(function (ch) { return el('span', { 'class': 'v-mark v-mark--' + ch[0], text: ch[1] }); }));
      marksEl.appendChild(group);
      var w = group.offsetWidth, h = group.offsetHeight;
      var x0 = ax - base.left + sx;
      var x = x0, y = ay - base.top + sy - h - 2;
      // No room above (top of the canvas, or the top edge of the scroll area holding it): sit just inside the element.
      if (y < sy || y - sy + base.top < c.top) y = ay - base.top + sy + 2;
      for (var guard = 0, p; guard < 40 && (p = hit(x, y, w, h)); guard++) {
        x = p.x + p.w + 4;
        if (x + w > width) { x = x0; y = p.y + p.h + 2; }
      }
      group.style.left = Math.max(0, Math.min(x, width - w)) + 'px';
      group.style.top = Math.max(0, y) + 'px';
      placed.push({ x: x, y: y, w: w, h: h });
    });
  }
  var marksQueued = false;
  function queueMarks() {
    if (marksQueued) return;
    marksQueued = true;
    requestAnimationFrame(function () { marksQueued = false; drawMarks(); });
  }
  // Dialogs and drawers use position: absolute, so they do not stretch the screen; grow its height to fit.
  function fit() {
    screenEl.style.minHeight = '';
    if (screenEl.scrollHeight > screenEl.clientHeight) screenEl.style.minHeight = screenEl.scrollHeight + 'px';
  }
  function refresh() { fit(); drawMarks(); }
  function sync() {
    root.setAttribute('data-hl', st.hl ? '1' : '0');
    root.setAttribute('data-bare', st.bare ? '1' : '0');
    app.setAttribute('data-notes', st.notes && st.screen !== OV ? '1' : '0');
    app.setAttribute('data-view', st.screen === OV ? 'overview' : 'screen');
    btnNew.setAttribute('aria-pressed', String(st.hl));
    btnNotes.setAttribute('aria-pressed', String(st.notes));
    refresh();
  }
  function deviceOf(s) { return (s.device || M.device) === 'mobile' ? 'mobile' : 'desktop'; }
  function render() {
    if (st.screen === OV) { renderOverview(); return; }
    ovEl.hidden = true;
    frame.hidden = false;
    var s = screens[st.screen];
    frame.className = 'v-frame v-frame--' + deviceOf(s);
    var ids = s.states.map(function (x) { return x.id; });
    if (ids.indexOf(st.state) < 0) st.state = ids[0];
    var tpl = document.getElementById('tpl-' + s.id);
    screenEl.innerHTML = '';
    if (!tpl) { fail('Missing fragment for screen: ' + s.id); return; }
    screenEl.appendChild(tpl.content.cloneNode(true));
    applyIcons();
    applyState();
    all('.v-nav__item', navEl).forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-screen') === s.id)); });
    buildStateBar();
    buildNotes();
    sync();
    if (!st.bare) history.replaceState(null, '', '#s=' + s.id + '&st=' + st.state);
  }
  function go(target) {
    var parts = String(target).split('#');
    if (parts[0] !== OV && !screens[parts[0]]) { fail('data-goto points to an unknown screen: ' + target); return; }
    st.screen = parts[0];
    st.state = parts[1] || null;
    render();
    var sc = frame.parentNode;
    if (sc) sc.scrollTop = 0;
    canvas.scrollTop = 0;
  }
  function byId(id) {
    var n = screenEl.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(id) : id));
    if (!n) fail('Element #' + id + ' not found in screen ' + st.screen);
    return n;
  }

  // ---- Overview: what the feature is, the screen roadmap with live thumbnails, what changes, how to read the mockup.
  function kindOf(s) {
    if (!s.existing) return 'new';
    var tpl = document.getElementById('tpl-' + s.id);
    return tpl && tpl.content.querySelector('[data-new]') ? 'changed' : 'unchanged';
  }
  function kindLabel(k) { return k === 'new' ? T.newScreen : k === 'changed' ? T.changedScreen : T.unchangedScreen; }
  function thumb(s, stateId, cardW) {
    var mobile = deviceOf(s) === 'mobile';
    var w = mobile ? 390 : 1440, h = mobile ? 844 : 900;
    cardW = cardW || 298;
    // Desktop thumbnails fill the card width; mobile ones keep the same height and are centered.
    var scale = mobile ? (cardW * 900 / 1440) / h : cardW / w;
    var boxH = Math.round(h * scale);
    var inner = el('div', { 'class': 'm-screen v-thumb__screen' });
    inner.style.width = w + 'px';
    inner.style.height = h + 'px';
    inner.style.minHeight = h + 'px'; // .m-app and .m-mobile stretch to the screen height through min-height: inherit
    inner.style.transform = 'scale(' + scale + ')';
    var tpl = document.getElementById('tpl-' + s.id);
    if (tpl) {
      inner.appendChild(tpl.content.cloneNode(true));
      applyIcons(inner);
      applyState(inner, stateId || s.states[0].id);
    }
    if (mobile) inner.style.left = 'calc(50% - ' + Math.round(w * scale / 2) + 'px)';
    var box = el('div', { 'class': 'v-thumb' + (mobile ? ' v-thumb--mobile' : '') }, [inner]);
    box.style.height = boxH + 'px';
    box.style.width = Math.round(w * scale) + 'px';
    box._fit = function () {
      // Grow the thumbnail to the screen's real height, so nothing below the fold is hidden from review.
      var full = Math.max(h, inner.scrollHeight);
      inner.style.height = full + 'px';
      box.style.height = Math.round(full * scale) + 'px';
    };
    return box;
  }

  // ---- Review sheet: every screen in every state on one page, used by the capture script for a quick visual check.
  var SHEET_PER_PAGE = 6;
  function sheetTiles() {
    var tiles = [];
    order.forEach(function (id) { screens[id].states.forEach(function (x) { tiles.push({ s: screens[id], state: x }); }); });
    return tiles;
  }
  function renderSheet(page) {
    var tiles = sheetTiles();
    frame.hidden = true;
    ovEl.hidden = false;
    screenEl.innerHTML = '';
    ovEl.innerHTML = '';
    ovEl.className = 'v-ov v-sheet';
    var grid = el('div', { 'class': 'v-sheet__grid' });
    var boxes = [];
    tiles.slice(page * SHEET_PER_PAGE, (page + 1) * SHEET_PER_PAGE).forEach(function (t, i) {
      var box = thumb(t.s, t.state.id, 680);
      boxes.push(box);
      grid.appendChild(el('div', { 'class': 'v-sheet__tile' }, [
        el('div', { 'class': 'v-sheet__label', text: (page * SHEET_PER_PAGE + i + 1) + '. ' + t.s.name + ' — ' + (t.state.name || t.state.id) + '  [' + t.s.id + ' / ' + t.state.id + ']' }),
        box
      ]));
    });
    ovEl.appendChild(grid);
    boxes.forEach(function (b) { b._fit(); });
    return { pages: Math.ceil(tiles.length / SHEET_PER_PAGE), height: Math.ceil(ovEl.scrollHeight + 32) };
  }
  function renderOverview() {
    frame.hidden = true;
    ovEl.hidden = false;
    ovEl.className = 'v-ov';
    screenEl.innerHTML = '';
    ovEl.innerHTML = '';
    all('.v-nav__item', navEl).forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-screen') === OV)); });
    var kinds = { 'new': 0, changed: 0, unchanged: 0 };
    M.screens.forEach(function (s) { kinds[kindOf(s)] += 1; });
    var nStates = M.screens.reduce(function (n, s) { return n + s.states.length; }, 0);
    var counts = [M.screens.length + ' ' + T.nScreens, nStates + ' ' + T.nStates];
    if (hasExisting) counts.push(kinds['new'] + ' ' + T.nNew + ', ' + kinds.changed + ' ' + T.nChanged + ', ' + kinds.unchanged + ' ' + T.nUnchanged);

    ovEl.appendChild(el('section', { 'class': 'v-ov__head' }, [
      el('div', { 'class': 'v-ov__eyebrow', text: (M.mode === 'existing-app' ? T.modeExisting : T.modeNew) }),
      el('h1', { text: M.feature }),
      M.summary ? el('p', { 'class': 'v-ov__summary', text: M.summary }) : null,
      el('div', { 'class': 'v-ov__meta' }, counts.map(function (c) { return el('span', { 'class': 'v-ov__chip', text: c }); })),
      (M.sources || []).length ? el('div', { 'class': 'v-ov__sources', text: T.sources + ': ' + M.sources.join(', ') }) : null
    ]));

    var road = el('section', { 'class': 'v-ov__section' }, [el('h2', { text: T.roadmap })]);
    var stepNo = 0;
    (M.flows || []).forEach(function (f) {
      var row = el('div', { 'class': 'v-ov__flow' });
      f.screens.forEach(function (id, i) {
        var s = screens[id];
        if (!s) return;
        stepNo += 1;
        var k = kindOf(s);
        if (i > 0) row.appendChild(el('div', { 'class': 'v-ov__arrow', 'aria-hidden': 'true', text: '→' }));
        row.appendChild(el('button', { 'class': 'v-ov__card v-ov__card--' + k, type: 'button', on: { click: function () { go(id); } } }, [
          thumb(s),
          el('div', { 'class': 'v-ov__card-body' }, [
            el('div', { 'class': 'v-ov__step', text: T.step + ' ' + stepNo }),
            el('div', { 'class': 'v-ov__name', text: s.name }),
            hasExisting ? el('span', { 'class': 'v-pill v-pill--' + (k === 'new' ? 'new' : 'old'), text: kindLabel(k) }) : null,
            s.purpose ? el('p', { 'class': 'v-ov__purpose', text: s.purpose }) : null,
            el('div', { 'class': 'v-ov__states', text: s.states.length + ' ' + T.nStates + ': ' + s.states.map(function (x) { return x.name || x.id; }).join(' · ') })
          ])
        ]));
      });
      road.appendChild(el('div', { 'class': 'v-ov__flowwrap' }, [
        el('h3', { text: f.name }),
        f.goal ? el('p', { 'class': 'v-ov__goal', text: f.goal }) : null,
        row
      ]));
    });
    ovEl.appendChild(road);

    var ch = el('section', { 'class': 'v-ov__section' }, [el('h2', { text: T.changes })]);
    var list = el('div', { 'class': 'v-ov__list' });
    (M.specRefs || []).forEach(function (r) {
      var on = M.screens.filter(function (s) { return (s.specRefs || []).indexOf(r.id) >= 0; });
      list.appendChild(el('div', { 'class': 'v-note' }, [
        el('span', { 'class': 'v-note__id v-note__id--spec', text: r.id }),
        el('span', {}, [
          document.createTextNode(r.text || ''),
          on.length ? el('span', { 'class': 'v-ov__links' }, [document.createTextNode(T.shownOn + ': ')].concat(on.map(function (s, i) {
            return el('a', { href: '#s=' + s.id, 'class': 'v-ov__link', text: (i ? ', ' : '') + s.name, on: { click: function (e) { e.preventDefault(); go(s.id); } } });
          }))) : null
        ])
      ]));
    });
    ch.appendChild(list);
    ovEl.appendChild(ch);

    var notes = el('section', { 'class': 'v-ov__section v-ov__cols' });
    var colA = el('div', {}, [el('h2', { text: T.assumptions })]);
    if (!(M.assumptions || []).length) colA.appendChild(el('p', { text: T.none }));
    (M.assumptions || []).forEach(function (a) { colA.appendChild(noteRow('assume', a.id, a.text)); });
    var colQ = el('div', {}, [el('h2', { text: T.questions })]);
    if (!(M.openQuestions || []).length) colQ.appendChild(el('p', { text: T.none }));
    (M.openQuestions || []).forEach(function (x) { colQ.appendChild(noteRow('question', x.id, x.text)); });
    notes.appendChild(colA);
    notes.appendChild(colQ);
    ovEl.appendChild(notes);

    var how = T.howToItems.filter(function (t, i) { return hasExisting || i !== 2; });
    ovEl.appendChild(el('section', { 'class': 'v-ov__section v-ov__how' }, [
      el('h2', { text: T.howTo }),
      el('ul', {}, how.map(function (t) { return el('li', { text: t }); }))
    ]));
    stateBar.innerHTML = '';
    notesEl.innerHTML = '';
    sync();
    if (!st.bare) history.replaceState(null, '', '#s=' + OV);
  }

  screenEl.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (a) e.preventDefault();
    var n = e.target.closest('[data-goto],[data-set-state],[data-open],[data-close],[data-toggle]');
    if (!n || !screenEl.contains(n) || n.disabled || n.classList.contains('is-disabled')) return;
    if (n.hasAttribute('data-close')) {
      var id = n.getAttribute('data-close');
      var box = id ? byId(id) : n.closest('.m-modal,.m-drawer,.m-menu,.m-toast');
      if (box) box.hidden = true;
    }
    if (n.hasAttribute('data-open')) { var o = byId(n.getAttribute('data-open')); if (o) o.hidden = false; }
    if (n.hasAttribute('data-toggle')) { var t = byId(n.getAttribute('data-toggle')); if (t) t.hidden = !t.hidden; }
    if (n.hasAttribute('data-set-state')) {
      var want = n.getAttribute('data-set-state');
      if (screens[st.screen].states.some(function (x) { return x.id === want; })) { st.state = want; applyState(); buildStateBar(); history.replaceState(null, '', '#s=' + st.screen + '&st=' + st.state); }
      else fail('data-set-state points to an unknown state: ' + want);
    }
    if (n.hasAttribute('data-goto')) { go(n.getAttribute('data-goto')); return; }
    requestAnimationFrame(refresh);
  });
  screenEl.addEventListener('submit', function (e) { e.preventDefault(); });
  window.addEventListener('resize', refresh);
  // Scroll events do not bubble, but they pass through ancestors in the capture phase: this catches the
  // canvas itself and any scroll area inside a fragment.
  canvas.addEventListener('scroll', queueMarks, true);
  if (window.ResizeObserver) new ResizeObserver(queueMarks).observe(screenEl);

  buildNav();

  // ---- Capture API: the capture script drives one page through these calls instead of reloading it per image.
  function snapshot(screen, state, opts) {
    opts = opts || {};
    st.bare = true; st.notes = false; st.hl = !!opts.hl;
    st.screen = screen; st.state = state || null;
    render();
    if (screen === OV) return { screen: OV, state: OV, device: 'desktop', height: Math.ceil(ovEl.scrollHeight + 48), textLength: (ovEl.innerText || '').trim().length, newMarks: 0 };
    return {
      screen: screen, state: st.state, device: deviceOf(screens[screen]),
      height: Math.ceil(Math.max(screenEl.getBoundingClientRect().height, screenEl.scrollHeight)),
      textLength: (screenEl.innerText || '').trim().length,
      newMarks: all('[data-new]', screenEl).filter(visible).length
    };
  }
  window.__mockup = {
    shots: function () {
      var out = [];
      try { out.push(snapshot(OV)); } catch (err) { fail('overview: ' + err.message); }
      order.forEach(function (id) {
        screens[id].states.forEach(function (x) {
          try { out.push(snapshot(id, x.id)); } catch (err) { fail(id + '/' + x.id + ': ' + err.message); }
        });
      });
      return out;
    },
    show: function (screen, state, hl) { return snapshot(screen, state, { hl: hl }); },
    sheet: function (page) { st.bare = true; st.notes = false; st.hl = true; sync(); return renderSheet(page); },
    errors: function () { return errors; }
  };

  // ---- Measure mode: walk every screen and state so the capture script learns the heights and catches errors.
  if (q.get('measure') === '1') {
    st.bare = true; st.hl = false; st.notes = false;
    var shots = [];
    try {
      st.screen = OV;
      render();
      shots.push({ screen: OV, state: OV, device: 'desktop', height: Math.ceil(ovEl.scrollHeight + 48), textLength: (ovEl.innerText || '').trim().length, newMarks: 0 });
    } catch (err) { fail('overview: ' + err.message); }
    order.forEach(function (id) {
      screens[id].states.forEach(function (x) {
        st.screen = id; st.state = x.id;
        try {
          render();
          shots.push({
            screen: id, state: x.id, device: deviceOf(screens[id]),
            height: Math.ceil(Math.max(screenEl.getBoundingClientRect().height, screenEl.scrollHeight)),
            textLength: (screenEl.innerText || '').trim().length,
            newMarks: all('[data-new]', screenEl).filter(visible).length
          });
        } catch (err) { fail(id + '/' + x.id + ': ' + err.message); }
      });
    });
    var out = el('script', { type: 'application/json', id: 'm-measure' });
    out.textContent = JSON.stringify({ errors: errors, shots: shots });
    document.body.appendChild(out);
    return;
  }

  render();
})();
