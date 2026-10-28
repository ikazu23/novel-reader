/* ══════ 文字の標準の大きさ ══════ */
// 文字の大きさは段落ごとに px で持っている（古い版の端末や、公開作品を読む人のアプリでも同じに見えるように、形は変えない）。
// そこに「標準」を足して、標準に対する比率で考える：
// ・全部の本の標準（設定の fontSize）と、この本だけの標準（本の fontStd）。この本だけの標準がない本は、その本でいちばん多く使っている大きさ
// ・新しい話・新しい段落・貼り付け・取り込み・イカ墨翻訳から届いた話・みんなの作品は、その本の標準に合わせる
// ・標準を変えると、その本の全部の話を同じ比率で拡大・縮小する（大きくした見出しなども比率はそのまま）
// ・行間・段落の余白・本文の幅も「この本／全部の本」を選んで変えられる
const FS_MIN = 8, FS_MAX = 72;
const FS_SCOPE_LS = LS_PREFIX + 'fs-scope';
const _fsModeCache = new WeakMap();
function fsGlobal(){ const g = parseFloat(state.settings && state.settings['fontSize']); return g > 0 ? g : 15; }
// その本でいちばん多く使っている文字の大きさ（文字数で数える）
function fsModeOf(eps){
  const cnt = new Map();
  (eps || []).forEach(e => (e && e.pages || []).forEach(pg => (pg.paras || []).forEach(pa => {
    if(pa.type && pa.type !== 'text') return;
    const s = parseFloat(pa.size); if(!(s > 0)) return;
    const n = String(pa.text || '').replace(/\s/g, '').length; if(!n) return;
    const k = Math.round(s * 2) / 2;
    cnt.set(k, (cnt.get(k) || 0) + n);
  })));
  let best = 0, bn = 0;
  cnt.forEach((n, k) => { if(n > bn){ bn = n; best = k; } });
  return best || 0;
}
function fsNovelMode(n){
  if(!n || !n.episodes) return 0;
  const sig = n.episodes.length + '|' + (n.updatedAt || '');
  const c = _fsModeCache.get(n);
  if(c && c.sig === sig) return c.v;
  const v = fsModeOf(n.episodes);
  _fsModeCache.set(n, { sig, v });
  return v;
}
// 本の標準（n を省くと、いま開いている本。開いていなければ全部の本の標準）
function stdFont(n){
  if(n === undefined) n = (state.currentNovelId && state.novel) ? state.novel : null;
  const own = n && parseFloat(n.fontStd);
  if(own > 0) return own;
  const m = n ? fsNovelMode(n) : 0;
  return m || fsGlobal();
}
function fsRound(v){ return Math.min(FS_MAX, Math.max(FS_MIN, Math.round(v * 10) / 10)); }
// 段落の大きさを、同じ比率で拡大・縮小する（文の中の px 指定も。em 指定は比率なのでそのまま）
function fsScaleParas(paras, f, base){
  let n = 0;
  (paras || []).forEach(pa => {
    if(pa.type && pa.type !== 'text') return;
    const s = parseFloat(pa.size) > 0 ? parseFloat(pa.size) : base;
    const ns = fsRound(s * f);
    if(ns !== pa.size){ pa.size = ns; n++; }
    if(pa.html && /font-size:\s*[\d.]+px/.test(pa.html)) pa.html = String(pa.html).replace(/font-size:\s*([\d.]+)px/g, (m, v) => 'font-size:' + fsRound(parseFloat(v) * f) + 'px');
  });
  return n;
}
function fsScaleEpisode(ep, pages, f, base){
  const wasUntouched = typeof kzUntouched === 'function' && ep && ep.kzImport && kzUntouched(ep);
  let n = 0;
  (pages || []).forEach(pg => { n += fsScaleParas(pg.paras, f, base); });
  // イカ墨翻訳から入れたままの話は「手で直した」にならないように、指紋も取り直す
  if(wasUntouched && pages === ep.pages && typeof kzPagesHash2 === 'function'){ ep.kzImport.h = kzPagesHash2(ep.pages); ep.kzImport.hv = 2; }
  return n;
}
// 本1冊を、標準 from → to に拡大・縮小
function fsScaleNovel(n, from, to){
  if(!n || !(from > 0) || !(to > 0) || Math.abs(from - to) < 0.05) return 0;
  const f = to / from;
  const isCur = state.novel && n === state.novel;
  let cnt = 0;
  (n.episodes || []).forEach(ep => {
    if(isCur && ep.id === state.currentEpisodeId && state.pages){
      try{ syncCurrentEpisode(); }catch(_){}
      const wasUntouched = typeof kzUntouched === 'function' && ep.kzImport && kzUntouched(ep);
      state.pages.forEach(pg => { cnt += fsScaleParas(pg.paras, f, from); });
      try{ syncCurrentEpisode(); }catch(_){}
      if(wasUntouched && typeof kzPagesHash2 === 'function'){ ep.kzImport.h = kzPagesHash2(ep.pages); ep.kzImport.hv = 2; }
    } else cnt += fsScaleEpisode(ep, ep.pages, f, from);
  });
  return cnt;
}
function fsSaveNovel(n){
  n.updatedAt = new Date().toISOString();
  if(state.novel && n === state.novel){
    const i = state.library.findIndex(x => x.id === n.id);
    if(i >= 0) state.library[i] = novelSnapshot(state.novel);
  }
  return libDbPut(n).catch(e => console.warn('fs save', e));
}
function fsRerender(){
  try{
    if(state.currentEpisodeId && state.pages){
      const cp = state.curPage;
      renderAllPages();
      if(cp != null && state.curPage !== cp && typeof goToPage === 'function') try{ goToPage(cp); }catch(_){}
    }
  }catch(e){ console.warn('fs rerender', e); }
  try{ uxPanelRefresh(); }catch(_){}
  try{ fsPanelRefresh(); }catch(_){}
}

// ── 変える範囲：この本／全部の本 ──
function fsScope(){
  if(!(state.currentNovelId && state.novel)) return 'all';
  try{ return localStorage.getItem(FS_SCOPE_LS) === 'all' ? 'all' : 'book'; }catch(_){ return 'book'; }
}
function fsSetScope(s){
  try{ localStorage.setItem(FS_SCOPE_LS, s === 'all' ? 'all' : 'book'); }catch(_){}
  fsPanelRefresh();
}
let _fsForceAll = false;
const FS_LOOK_KEYS = ['lineHeight', 'paraSpacing', 'textWidth'];
if(typeof lookSetting === 'function'){
  const _fsOrigLook = lookSetting;
  lookSetting = function(key, fallback){
    if(_fsForceAll && FS_LOOK_KEYS.includes(key)) return state.settings[key] != null ? state.settings[key] : fallback;
    return _fsOrigLook.apply(this, arguments);
  };
}
// 全部の本：設定に保存して、本ごとの値は消す（全部の本がこの値になる）
function fsClearOverride(key){
  const changed = new Set();
  (state.library || []).forEach(n => { if(n && n[key] != null){ delete n[key]; changed.add(n.id); } });
  if(state.novel && state.novel[key] != null){ delete state.novel[key]; changed.add(state.novel.id); }
  changed.forEach(id => {
    const n = (state.novel && state.novel.id === id) ? state.novel : state.library.find(x => x.id === id);
    if(n) fsSaveNovel(n);
  });
  if(changed.size){ try{ scheduleGdriveAutoSync(); }catch(_){} }
}
if(typeof storeLookSetting === 'function'){
  const _fsOrigStore = storeLookSetting;
  storeLookSetting = function(key, val){
    if(_fsForceAll && FS_LOOK_KEYS.includes(key)){
      state.settings[key] = val;
      try{ debouncedSaveSettings(); }catch(_){}
      fsClearOverride(key);
      return;
    }
    return _fsOrigStore.apply(this, arguments);
  };
}
['adjustLineHeight', 'adjustParaSpacing', 'adjustTextWidth'].forEach(fn => {
  if(typeof window[fn] !== 'function') return;
  const orig = window[fn];
  window[fn] = function(){
    if(fsScope() !== 'all') return orig.apply(this, arguments);
    _fsForceAll = true;
    try{ return orig.apply(this, arguments); }finally{ _fsForceAll = false; }
  };
});

// ── 標準を変える ──
let _fsAllTimer = null, _fsAllPending = null;
function fsAdjustStd(delta){
  if(fsScope() === 'book'){
    const n = state.novel; if(!n) return;
    if(state.editMode && state.curPage != null){ try{ syncEditorToState(state.curPage); }catch(_){} }
    const from = stdFont(n), to = fsRound(from + delta);
    if(to === from) return;
    const cnt = fsScaleNovel(n, from, to);
    n.fontStd = to;
    fsSaveNovel(n);
    try{ scheduleGdriveAutoSync(); }catch(_){}
    fsRerender();
    showToast(`この本の文字の大きさを ${to}px にしました${cnt ? '（全部の話）' : ''}`);
    return;
  }
  // 全部の本：押し終わってから、まとめてそろえる
  const base = _fsAllPending != null ? _fsAllPending : fsGlobal();
  _fsAllPending = fsRound(base + delta);
  fsPanelRefresh();
  clearTimeout(_fsAllTimer);
  _fsAllTimer = setTimeout(fsApplyAll, 900);
}
async function fsApplyAll(){
  const to = _fsAllPending; _fsAllPending = null;
  if(!(to > 0)) return;
  if(state.editMode && state.curPage != null){ try{ syncEditorToState(state.curPage); }catch(_){} }
  state.settings['fontSize'] = to;
  try{ debouncedSaveSettings(); }catch(_){}
  let books = 0;
  for(const lib of (state.library || []).slice()){
    const n = (state.novel && state.novel.id === lib.id) ? state.novel : lib;
    const from = stdFont(n);
    const cnt = fsScaleNovel(n, from, to);
    const had = n.fontStd != null;
    delete n.fontStd;
    if(cnt || had){ books++; await fsSaveNovel(n); }
  }
  if(books){ try{ scheduleGdriveAutoSync(); }catch(_){} }
  fsRerender();
  showToast(`全部の本の文字の大きさを ${to}px にそろえました`);
}

// ── 設定パネル ──
function fsPanelInstall(){
  const body = document.getElementById('panel-body'); if(!body || document.getElementById('fs-std-row')) return;
  const lh = document.getElementById('global-lineheight-val');
  const lhRow = lh && lh.closest('#panel-body > .ps'); if(!lhRow) return;
  const scope = document.createElement('div');
  scope.className = 'ps'; scope.id = 'fs-scope-row';
  scope.innerHTML = `<div class="pl">変える範囲</div><div class="pr"><button class="ob" data-s="book" onclick="fsSetScope('book')">この本</button><button class="ob" data-s="all" onclick="fsSetScope('all')">全部の本</button></div><div class="fs-hint"></div>`;
  const std = document.createElement('div');
  std.className = 'ps'; std.id = 'fs-std-row';
  std.innerHTML = `<div class="stepper-line"><div class="pl">文字の標準</div><div class="stepper-row"><button class="stepper-btn" onclick="fsAdjustStd(-1)">－</button><span class="stepper-val" id="fs-std-val">15px</span><button class="stepper-btn" onclick="fsAdjustStd(1)">＋</button></div></div>`;
  body.insertBefore(scope, lhRow);
  body.insertBefore(std, lhRow);
}
function fsPanelRefresh(){
  try{
    fsPanelInstall();
    const s = fsScope(), open = !!(state.currentNovelId && state.novel);
    const row = document.getElementById('fs-scope-row');
    if(row){
      row.style.display = open ? '' : 'none';
      row.querySelectorAll('.ob').forEach(b => b.classList.toggle('active', b.dataset.s === s));
      const h = row.querySelector('.fs-hint');
      if(h) h.textContent = s === 'all' ? '下の「文字の標準・行間・段落の余白・本文の幅」を、全部の本にそろえます' : '下の「文字の標準・行間・段落の余白・本文の幅」を、この本だけ変えます';
    }
    const v = document.getElementById('fs-std-val');
    if(v) v.textContent = (s === 'all' ? (_fsAllPending != null ? _fsAllPending : fsGlobal()) : stdFont()) + 'px';
    const fmt = { lineHeight: x => (+x).toFixed(1), paraSpacing: x => x + 'px', textWidth: x => x + '%' };
    const def = { lineHeight: 2.0, paraSpacing: 24, textWidth: 100 };
    const ids = { lineHeight: 'global-lineheight-val', paraSpacing: 'global-paraspacing-val', textWidth: 'global-textwidth-val' };
    FS_LOOK_KEYS.forEach(k => {
      const el = document.getElementById(ids[k]); if(!el) return;
      const val = s === 'all' ? (state.settings[k] != null ? state.settings[k] : def[k]) : lookSetting(k, def[k]);
      el.textContent = fmt[k](val);
    });
  }catch(e){ console.warn('fs panel', e); }
}
if(typeof togglePanel === 'function'){
  const _fsOrigTP = togglePanel;
  togglePanel = function(){
    try{ fsPanelInstall(); }catch(_){}
    const r = _fsOrigTP.apply(this, arguments);
    try{ fsPanelRefresh(); }catch(_){}
    return r;
  };
}

// ── 貼り付け：コピー元の文字の大きさは使わず、貼った場所の段落の大きさにそろえる ──
document.addEventListener('paste', e => {
  try{
    if(!state.editMode) return;
    const t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
    const editor = t && t.closest && t.closest('.page-editor');
    if(!editor || t.closest('.ko-tr, textarea, input')) return;
    const cd = e.clipboardData; if(!cd) return;
    const sel = window.getSelection(); if(!sel || !sel.rangeCount) return;
    let blk = sel.anchorNode; while(blk && blk.parentNode !== editor) blk = blk.parentNode;
    const size = (blk && blk.nodeType === 1 && parseFloat(blk.style.fontSize)) || stdFont();
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    if(!html && !text) return;
    const before = new Set([...editor.children]);
    e.preventDefault();
    if(html){
      const tpl = document.createElement('template');
      tpl.innerHTML = html.replace(/<!--[\s\S]*?-->/g, '');
      tpl.content.querySelectorAll('meta,style,script,title,link').forEach(x => x.remove());
      // 文の中だけ大きい・小さい文字は、まわりの段落との比率（em）にして残す
      const pxOf = el => { const m = /([\d.]+)px/.exec(el.style && el.style.fontSize || ''); return m ? parseFloat(m[1]) : 0; };
      const ratios = [];
      tpl.content.querySelectorAll('[style*="font-size"]').forEach(x => {
        const v = pxOf(x); if(!v) return;
        let a = x.parentElement;
        while(a && !pxOf(a)) a = a.parentElement;
        if(a) ratios.push([x, Math.round(v / pxOf(a) * 100) / 100]);
      });
      tpl.content.querySelectorAll('[style]').forEach(x => {
        x.style.removeProperty('font-size'); x.style.removeProperty('line-height'); x.style.removeProperty('font-family');
      });
      ratios.forEach(([x, r]) => { if(Math.abs(r - 1) > 0.04) x.style.fontSize = r + 'em'; });
      tpl.content.querySelectorAll('[style]').forEach(x => { if(!x.getAttribute('style').trim()) x.removeAttribute('style'); });
      tpl.content.querySelectorAll('font[size]').forEach(x => x.removeAttribute('size'));
      const div = document.createElement('div'); div.appendChild(tpl.content);
      document.execCommand('insertHTML', false, div.innerHTML);
    } else {
      document.execCommand('insertText', false, text);
    }
    // 新しくできた段落は、貼った場所の段落と同じ大きさに
    [...editor.children].forEach(c => {
      if(before.has(c) || c.dataset.type === 'image') return;
      c.style.fontSize = size + 'px';
      c.querySelectorAll('[style*="font-size"]').forEach(x => { if(/px/.test(x.style.fontSize)) x.style.removeProperty('font-size'); });
    });
    try{ editor.dispatchEvent(new Event('input', { bubbles: true })); }catch(_){}
  }catch(err){ console.warn('paste', err); }
}, true);

function fsFitShared(workId, eps){
  const book = (state.library || []).find(n => n.id === 'shared_' + workId);
  const to = book ? stdFont(book) : fsGlobal();
  const from = fsModeOf(eps);
  if(from > 0 && Math.abs(from - to) >= 0.05) (eps || []).forEach(ep => fsScaleEpisode(ep, ep.pages, to / from, from));
  return eps;
}
// ── みんなの作品：届いた話を、その本（新しい本なら全部の本）の標準に合わせる ──
if(typeof downloadWorkEpisodes === 'function'){
  const _fsOrigDl = downloadWorkEpisodes;
  downloadWorkEpisodes = async function(workId){
    const eps = await _fsOrigDl.apply(this, arguments);
    try{ fsFitShared(workId, eps); }catch(e){ console.warn('fs shared', e); }
    return eps;
  };
}
// 「文字の大きさ（全部の話）」の ± で全部の話を変えたら、この本の標準も同じだけ動かす
if(typeof adjustAllEpisodesFontSize === 'function'){
  const _fsOrigAllEp = adjustAllEpisodesFontSize;
  adjustAllEpisodesFontSize = function(delta){
    const n = state.novel, had = n && parseFloat(n.fontStd) > 0;
    const r = _fsOrigAllEp.apply(this, arguments);
    try{ if(had && n === state.novel){ n.fontStd = fsRound(parseFloat(n.fontStd) + delta); fsSaveNovel(n); } fsPanelRefresh(); }catch(_){}
    return r;
  };
}
/* ══════ 文字の標準の大きさここまで ══════ */
