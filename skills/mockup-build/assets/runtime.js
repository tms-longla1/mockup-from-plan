/* Runtime of the mockup file: screen navigation, state switching, marking the new parts,
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
    vi: { wireframe: 'WIREFRAME', mockup: 'MOCKUP', showNew: 'Phần mới', showNotes: 'Chú thích', state: 'Trạng thái', isNew: 'MỚI', isExisting: 'Đã có', newScreen: 'Màn hình mới', existingScreen: 'Màn hình đã có', changedScreen: 'Màn hình đã có, có thay đổi', specRefs: 'Yêu cầu trong spec', assumptions: 'Giả định (spec không nói rõ)', questions: 'Câu hỏi mở', none: 'Không có', banner: 'Bản minh họa sinh từ plan/spec để hình dung tính năng. Không phải thiết kế cuối cùng.' },
    en: { wireframe: 'WIREFRAME', mockup: 'MOCKUP', showNew: 'New parts', showNotes: 'Notes', state: 'State', isNew: 'NEW', isExisting: 'Existing', newScreen: 'New screen', existingScreen: 'Existing screen', changedScreen: 'Existing screen with changes', specRefs: 'Spec requirements', assumptions: 'Assumptions (not stated in spec)', questions: 'Open questions', none: 'None', banner: 'Illustration generated from the plan/spec. Not a final design.' },
    ja: { wireframe: 'ワイヤーフレーム', mockup: 'モックアップ', showNew: '追加箇所', showNotes: '注記', state: '状態', isNew: '新規', isExisting: '既存', newScreen: '新規画面', existingScreen: '既存画面', changedScreen: '既存画面（変更あり）', specRefs: '仕様の要件', assumptions: '仮定（仕様に記載なし）', questions: '未決事項', none: 'なし', banner: 'プラン・仕様から生成したイメージです。最終デザインではありません。' }
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

  var q = new URLSearchParams(location.hash.slice(1));
  var hasExisting = M.screens.some(function (s) { return s.existing; });
  var st = {
    screen: screens[q.get('s')] ? q.get('s') : order[0],
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
      el('div', { 'class': 'v-scroll' }, [frame])
    ]),
    notesEl
  ]);
  document.body.appendChild(app);

  function buildNav() {
    navEl.innerHTML = '';
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
  function applyIcons() {
    all('[data-icon]', screenEl).forEach(function (n) {
      var body = ICONS[n.getAttribute('data-icon')];
      if (!body) { fail('Unknown icon: ' + n.getAttribute('data-icon')); return; }
      n.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
    });
  }
  function applyState() {
    all('[data-state]', screenEl).forEach(function (n) {
      n.hidden = n.getAttribute('data-state').split(/\s+/).indexOf(st.state) < 0;
    });
  }
  function mark(target, kind, text, side, base, row) {
    var r = target.getBoundingClientRect();
    var m = el('span', { 'class': 'v-mark v-mark--' + kind, text: text });
    m.style.top = Math.max(0, r.top - base.top - 19 - row * 17) + 'px';
    if (side === 'left') m.style.left = Math.max(0, r.left - base.left) + 'px';
    else m.style.right = Math.max(0, base.right - r.right) + 'px';
    marksEl.appendChild(m);
  }
  function drawMarks() {
    marksEl.innerHTML = '';
    var base = canvas.getBoundingClientRect();
    if (st.hl) all('[data-new]', screenEl).filter(visible).forEach(function (n) { mark(n, 'new', T.isNew, 'left', base, 0); });
    if (st.notes) all('[data-spec],[data-assume]', screenEl).filter(visible).forEach(function (n) {
      var row = 0;
      if (n.hasAttribute('data-spec')) { mark(n, 'spec', n.getAttribute('data-spec'), 'right', base, row); row += 1; }
      if (n.hasAttribute('data-assume')) mark(n, 'assume', n.getAttribute('data-assume'), 'right', base, row);
    });
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
    app.setAttribute('data-notes', st.notes ? '1' : '0');
    btnNew.setAttribute('aria-pressed', String(st.hl));
    btnNotes.setAttribute('aria-pressed', String(st.notes));
    refresh();
  }
  function deviceOf(s) { return (s.device || M.device) === 'mobile' ? 'mobile' : 'desktop'; }
  function render() {
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
    if (!screens[parts[0]]) { fail('data-goto points to an unknown screen: ' + target); return; }
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

  buildNav();

  // ---- Measure mode: walk every screen and state so the capture script learns the heights and catches errors.
  if (q.get('measure') === '1') {
    st.bare = true; st.hl = false; st.notes = false;
    var shots = [];
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
