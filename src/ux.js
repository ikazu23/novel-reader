/* ══════ 使いやすさ ══════ */
// 読む人がつまずきやすいところを直す（見た目と操作だけ。本のデータの形は変えない）
// 2. 本棚に「続きを読む」と進み具合・表紙なしの本に自動の表紙
// 3. 読む画面：本の名前・進み具合・まんなかタップでバーを隠す   4. 設定パネルをタブに分ける
// 5. メニューの整理（見出し・やさしい言葉）・目次の「公開」「続きから」・＋ボタン
const UX_READ_LS = LS_PREFIX + 'ux-read-at';
function uxEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function uxIsNative(){ try{ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }catch(_){ return false; } }
function uxSortedEps(n){ return ((n && n.episodes) || []).slice().sort((a, b) => a.number - b.number); }
function uxReadOnlyBook(n){ n = n || state.novel; return !!(n && (n.ext || n.shared)); }
function uxOpenEp(id){
  if(typeof isSharedNovel === 'function' && isSharedNovel() && typeof openSharedEpisodeFresh === 'function'){ openSharedEpisodeFresh(id); return; }
  openEpisode(id);
}
function uxReadMap(){ try{ return JSON.parse(localStorage.getItem(UX_READ_LS) || '{}') || {}; }catch(_){ return {}; } }

// ── 3. 読む画面 ──
function uxTopbarInfo(){
  try{
    const t = document.getElementById('topbar-title'); if(!t) return;
    const n = state.novel;
    if(!n || !state.currentEpisodeId){ t.removeAttribute('data-book'); return; }
    const eps = uxSortedEps(n), i = eps.findIndex(e => e.id === state.currentEpisodeId);
    const ep = eps[i];
    const bt = n.title || '無題の小説';
    if(ep && (ep.title || '').trim() === bt.trim()) t.removeAttribute('data-book');   // 1話だけの本：同じ名前を2回出さない
    else t.setAttribute('data-book', bt);
  }catch(_){}
}
let _uxProgRaf = 0;
function uxProgress(){
  if(_uxProgRaf) return;
  _uxProgRaf = requestAnimationFrame(() => {
    _uxProgRaf = 0;
    try{
      let bar = document.getElementById('ux-prog');
      const tb = document.getElementById('topbar');
      if(!bar && tb){ bar = document.createElement('div'); bar.id = 'ux-prog'; bar.innerHTML = '<i></i>'; tb.appendChild(bar); }
      if(!bar || !state.pages || !state.pages.length || !state.currentEpisodeId){ if(bar) bar.style.display = 'none'; return; }
      const cur = document.getElementById('page-' + state.curPage);
      let f = 0;
      if(cur){ const max = cur.scrollHeight - cur.clientHeight; f = max > 4 ? Math.min(1, Math.max(0, cur.scrollTop / max)) : 1; }
      const p = Math.min(1, (state.curPage + f) / state.pages.length);
      bar.style.display = '';
      bar.firstChild.style.width = (p * 100).toFixed(1) + '%';
    }catch(_){}
  });
}
document.addEventListener('scroll', e => { if(e.target && e.target.classList && e.target.classList.contains('page')) uxProgress(); }, true);
if(typeof updatePageIndicator === 'function'){
  const _uxOrigUPI = updatePageIndicator;
  updatePageIndicator = function(){
    const r = _uxOrigUPI.apply(this, arguments);
    try{
      const eps = uxSortedEps(state.novel), i = eps.findIndex(e => e.id === state.currentEpisodeId);
      if(i >= 0) document.querySelectorAll('.pnl').forEach(l => { l.textContent = `${i + 1} / ${eps.length}話`; });
    }catch(_){}
    uxTopbarInfo(); uxProgress();
    return r;
  };
}
// まんなかを1回タップ → 上のバーを隠す／出す
function uxSetImmersive(on){
  const b = document.body;
  if(on === b.classList.contains('ux-immersive')) return;
  const tb = document.getElementById('topbar');
  const h = tb ? tb.offsetHeight : 0;
  const cur = document.getElementById('page-' + state.curPage);
  b.classList.toggle('ux-immersive', on);
  // 文字が上下に跳ねないように、読んでいる位置を合わせる
  if(cur && h) cur.scrollTop = Math.max(0, cur.scrollTop + (on ? -h : h));
  uxProgress();
}
let _uxTapTimer = null, _uxTapAt = 0, _uxDownX = 0, _uxDownY = 0;
document.addEventListener('pointerdown', e => { _uxDownX = e.clientX; _uxDownY = e.clientY; }, true);
document.addEventListener('click', e => {
  const vp = document.getElementById('viewport');
  if(!vp || !e.target || !e.target.closest || !e.target.closest('#viewport')) return;
  const now = Date.now();
  if(_uxTapTimer && now - _uxTapAt < 350){ clearTimeout(_uxTapTimer); _uxTapTimer = null; return; }   // ダブルタップ（編集）
  _uxTapAt = now;
  if(state.editMode || !state.currentEpisodeId) return;
  if(Math.abs(e.clientX - _uxDownX) > 8 || Math.abs(e.clientY - _uxDownY) > 8) return;
  if(e.target.closest('button, a, input, select, textarea, label, .kw, .ko-tr, .para-img-wrap, ruby')) return;
  const r = vp.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  if(x < 0.22 || x > 0.78 || y < 0.15 || y > 0.85) return;   // 端はページ送りなどに使う
  _uxTapTimer = setTimeout(() => {
    _uxTapTimer = null;
    if(state.editMode || (typeof hasTextSelection === 'function' && hasTextSelection())) return;
    if(document.querySelector('#ko-sheet.show, #side-panel.open, #modal-ov.show, #search-overlay.show, #search-overlay.open')) return;
    uxSetImmersive(!document.body.classList.contains('ux-immersive'));
  }, 320);
}, false);
const UX_TIP_LS = LS_PREFIX + 'ux-tip-tap';
if(typeof openEpisode === 'function'){
  const _uxOrigOpenEp = openEpisode;
  openEpisode = function(id){
    const r = _uxOrigOpenEp.apply(this, arguments);
    try{
      uxSetImmersive(false);
      if(state.currentNovelId){ const m = uxReadMap(); m[state.currentNovelId] = Date.now(); localStorage.setItem(UX_READ_LS, JSON.stringify(m)); }
      uxTopbarInfo(); uxProgress();
      let seen = false; try{ seen = localStorage.getItem(UX_TIP_LS) === '1'; }catch(_){}
      if(!seen){ try{ localStorage.setItem(UX_TIP_LS, '1'); }catch(_){} setTimeout(() => showToast('まんなかをタップすると、上のバーを隠せるよ'), 900); }
    }catch(_){}
    return r;
  };
}
['enterEditMode', 'showToc', 'showLibrary'].forEach(fn => {
  if(typeof window[fn] !== 'function') return;
  const orig = window[fn];
  window[fn] = function(){ try{ uxSetImmersive(false); }catch(_){} return orig.apply(this, arguments); };
});
if(typeof toggleReadingMode === 'function'){
  const _uxOrigRM = toggleReadingMode;
  toggleReadingMode = function(){
    const r = _uxOrigRM.apply(this, arguments);
    try{ showToast(state.readingMode ? '読書モード：オン（ダブルタップしても編集にならないよ）' : '読書モード：オフ（ダブルタップで編集できるよ）'); }catch(_){}
    return r;
  };
}

// ── 2. 本棚 ──
const _uxCoverCache = {};
function uxAutoCover(n){
  const k = (n.title || '') + '|' + (n.author || '');
  if(!_uxCoverCache[k] && typeof azMakeCover === 'function') _uxCoverCache[k] = azMakeCover(n.title || '無題の小説', n.author || '');
  return _uxCoverCache[k] || '';
}
function uxProgressOf(n){
  if(!n || !n.lastReadId) return 0;
  const eps = uxSortedEps(n), i = eps.findIndex(e => e.id === n.lastReadId);
  return i < 0 || !eps.length ? 0 : (i + 1) / eps.length;
}
function uxDecorateLibrary(){
  try{
    const grid = document.getElementById('library-grid'); if(!grid) return;
    grid.querySelectorAll('.lib-card[data-novel-id]').forEach(card => {
      const n = (state.library || []).find(x => x.id === card.dataset.novelId); if(!n) return;
      const cv = card.querySelector('.lib-card-cover'); if(!cv) return;
      // 表紙がない本：題名入りの表紙を作って見せる（保存はしない）
      if(!n.cover && (n.episodes || []).some(e => e.charCount > 0)){
        const url = uxAutoCover(n);
        if(url){ cv.style.backgroundImage = `url('${url}')`; cv.classList.add('ux-auto-cover'); const ph = cv.querySelector('.lib-card-cover-placeholder'); if(ph) ph.remove(); }
      }
      const p = uxProgressOf(n);
      if(p > 0 && !cv.querySelector('.ux-pbar')) cv.insertAdjacentHTML('beforeend', `<div class="ux-pbar"><i style="width:${Math.round(p * 100)}%"></i></div>`);
    });
    // 続きを読む（いちばん最近読んだ本）
    const old = document.getElementById('ux-continue'); if(old) old.remove();
    const m = uxReadMap();
    const cand = (state.library || []).filter(n => n.lastReadId && m[n.id] && (n.episodes || []).some(e => e.id === n.lastReadId)).sort((a, b) => m[b.id] - m[a.id])[0];
    if(!cand) return;
    const ep = cand.episodes.find(e => e.id === cand.lastReadId);
    const eps = uxSortedEps(cand), i = eps.findIndex(e => e.id === ep.id);
    const cover = cand.cover || uxAutoCover(cand);
    const box = document.createElement('div');
    box.id = 'ux-continue';
    box.innerHTML = `<button class="ux-cont" onclick="uxContinue('${cand.id}')">
      <span class="ux-cont-cv" style="${cover ? `background-image:url('${cover}')` : ''}"></span>
      <span class="ux-cont-main"><small>続きを読む</small><b>${uxEsc(cand.title || '無題の小説')}</b>
        <span class="ux-cont-ep">${uxEsc(ep.title || ('第' + ep.number + '話'))}${eps.length > 1 ? `<em>${i + 1} / ${eps.length}話</em>` : ''}</span>
        <span class="ux-pbar line"><i style="width:${Math.round(uxProgressOf(cand) * 100)}%"></i></span></span>
      <span class="ux-cont-go">▶</span></button>`;
    grid.parentNode.insertBefore(box, document.getElementById('az-banner') || grid);
  }catch(e){ console.warn('ux lib', e); }
}
function uxContinue(nid){
  const n = (state.library || []).find(x => x.id === nid); if(!n || !n.lastReadId) return;
  _resumeNovelId = nid; _resumeEpId = n.lastReadId;
  resumeLastEpisode();
}
if(typeof renderLibrary === 'function'){
  const _uxOrigRL = renderLibrary;
  renderLibrary = function(){ const r = _uxOrigRL.apply(this, arguments); uxDecorateLibrary(); return r; };
}

// ── 5. 目次：「続きから読む」「作品を公開」・＋ボタン ──
function uxDecorateToc(){
  try{
    const n = state.novel; if(!n) return;
    document.body.classList.toggle('ux-ro-book', uxReadOnlyBook(n));
    const fab = document.getElementById('toc-fab');
    if(fab && !fab.querySelector('.ux-fab-l')) fab.insertAdjacentHTML('beforeend', '<span class="ux-fab-l">話を追加</span>');
    const host = document.getElementById('toc-info-text'); if(!host) return;
    let box = document.getElementById('ux-toc-acts');
    if(!box){ box = document.createElement('div'); box.id = 'ux-toc-acts'; host.appendChild(box); }
    const eps = uxSortedEps(n);
    const last = n.lastReadId && eps.find(e => e.id === n.lastReadId);
    const first = eps.find(e => !(uxReadOnlyBook(n) && e.draft));
    const canPub = typeof openPublishModal === 'function' && !uxReadOnlyBook(n) && eps.some(e => e.charCount > 0);
    const pub = n.publish && n.publish.workId && n.publish.status === 'public';
    box.innerHTML = (last ? `<button class="ux-ta main" onclick="uxOpenEp('${last.id}')">続きから読む<small>${uxEsc(last.title || ('第' + last.number + '話'))}</small></button>`
        : first && first.charCount > 0 ? `<button class="ux-ta main" onclick="uxOpenEp('${first.id}')">1話から読む</button>` : '')
      + (canPub ? `<button class="ux-ta" onclick="openPublishModal()">${pub ? '公開中・更新する' : '作品を公開する'}</button>` : '');
  }catch(e){ console.warn('ux toc', e); }
}
if(typeof renderToc === 'function'){
  const _uxOrigRT = renderToc;
  renderToc = function(){ const r = _uxOrigRT.apply(this, arguments); uxDecorateToc(); return r; };
}

// ── 5. メニューの整理 ──
function uxTidyMenus(){
  try{
    const bm = document.getElementById('backup-menu');
    if(bm && !bm.dataset.ux){
      bm.dataset.ux = '1';
      const head = (t) => { const d = document.createElement('div'); d.className = 'ux-mh'; d.textContent = t; return d; };
      const st = document.getElementById('gdrive-menu-status');
      if(st) st.parentNode.insertBefore(head('クラウド同期'), st);
      const link = [...bm.querySelectorAll('button')].find(b => /openAddByLinkModal|openProfileModal/.test(b.getAttribute('onclick') || ''));
      if(link) link.parentNode.insertBefore(head('作品・アカウント'), link);
      const bk = [...bm.querySelectorAll('button')].find(b => /doBackup\(/.test(b.getAttribute('onclick') || ''));
      if(bk){
        const note = bk.previousElementSibling;
        if(note && /Web版のみ/.test(note.textContent || '')){ if(!uxIsNative()) note.style.display = 'none'; }
        bk.parentNode.insertBefore(head('ファイル'), note && /Web版のみ/.test(note.textContent || '') ? note : bk);
      }
      const b2 = document.getElementById('ko-import-beta2');
      if(b2 && b2.lastChild && b2.lastChild.nodeType === 3) b2.lastChild.textContent = ' β2の単語帳などを引き継ぐ ';
    }
    const em = document.getElementById('export-menu');
    if(em && !em.dataset.ux){
      em.dataset.ux = '1';
      const first = em.firstElementChild;
      if(first && /Web版のみ/.test(first.textContent || '') && !uxIsNative()) first.style.display = 'none';
      const ren = { 'テキストでエクスポート（ZIP）': 'テキストで書き出す（ZIP）', 'JSONでエクスポート（バックアップ用）': 'この本をバックアップ用に保存', 'JSONからインポート': 'バックアップから本を読み込む',
        'テキストを一括インポート（.txt）': 'テキストから話を追加（.txt）', 'ZIPから一括インポート（.txt/.html同梱）': 'ZIPから話を追加', '翻訳したページを読み込む（.html）': '訳したページから話を追加（.html）' };
      em.querySelectorAll('.export-menu-item span').forEach(s => { const t = s.textContent.trim(); if(ren[t]) s.textContent = ren[t]; });
    }
  }catch(e){ console.warn('ux menu', e); }
}

// ── 4. 設定パネル：タブに分ける（編集中は全部出す） ──
const UX_TABS = [['text', '文字'], ['tts', '読み上げ'], ['look', '見た目'], ['etc', 'その他']];
function uxPanelSetup(){
  const body = document.getElementById('panel-body'); if(!body || body.dataset.ux) return;
  body.dataset.ux = '1';
  const kind = el => {
    const t = (el.querySelector('.pl') || {}).textContent || '';
    const sm = (el.querySelector('summary') || {}).textContent || '';
    if(el.id === 'ko-panel-row' || /行間|段落の余白|本文の幅|文字サイズ|フォント/.test(t)) return 'text';
    if(/読み上げ/.test(t) || /読み方/.test(sm)) return 'tts';
    if(/背景/.test(t)) return 'look';
    return 'etc';
  };
  [...body.children].forEach(el => { el.dataset.uxT = kind(el); });
  [...body.querySelectorAll('.pl')].forEach(pl => {
    const t = pl.textContent.trim();
    if(t === 'この話の文字サイズ') pl.innerHTML = '文字の大きさ<small>この話</small>';
    else if(t === '全話の文字サイズ') pl.innerHTML = '文字の大きさ<small>全部の話</small>';
  });
  const bar = document.createElement('div');
  bar.id = 'ux-ptabs';
  bar.innerHTML = UX_TABS.map(([k, l]) => `<button data-k="${k}" onclick="uxPanelTab('${k}')">${l}</button>`).join('');
  body.insertBefore(bar, body.firstChild);
  const pv = document.createElement('div');
  pv.id = 'ux-preview'; pv.dataset.uxT = 'text';
  bar.after(pv);
  body.addEventListener('click', () => setTimeout(uxPanelRefresh, 60));
  uxPanelTab('text');
}
function uxPanelTab(k){
  const body = document.getElementById('panel-body'); if(!body) return;
  body.dataset.uxTab = k;
  document.querySelectorAll('#ux-ptabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  body.scrollTop = 0;
  uxPanelRefresh();
}
function uxCurFontSize(){
  try{
    for(const pg of (state.pages || [])) for(const p of (pg.paras || [])) if(p.type === 'text' && (p.text || '').trim() && p.size) return p.size;
  }catch(_){}
  return (state.settings && state.settings.fontSize) || 15;
}
function uxPanelRefresh(){
  try{
    const body = document.getElementById('panel-body'); if(!body) return;
    const fs = uxCurFontSize();
    body.querySelectorAll('.stepper-line').forEach(line => {
      const t = (line.querySelector('.pl') || {}).textContent || '';
      const v = line.querySelector('.stepper-val');
      if(v && /文字の大きさ/.test(t)) v.textContent = state.currentEpisodeId || /全部/.test(t) ? fs + 'px' : '—';
    });
    // 見本の文：いまの本文と同じ見た目で
    const pv = document.getElementById('ux-preview'); if(!pv) return;
    const real = document.querySelector('.page.cur .page-editor p[data-qi]');
    const cs = real ? getComputedStyle(real) : null;
    const root = getComputedStyle(document.documentElement);
    const sp = root.getPropertyValue('--para-spacing').trim() || '24px';
    const style = cs ? `font-family:${cs.fontFamily};font-size:${fs}px;line-height:${cs.lineHeight === 'normal' ? 2 : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2)};letter-spacing:${cs.letterSpacing};`
      : `font-size:${fs}px;line-height:${root.getPropertyValue('--para-line-height').trim() || 2};`;
    pv.innerHTML = `<div class="ux-pv-k">見本</div><p style="${style}margin:0 0 ${sp};">　山路を登りながら、こう考えた。智に働けば角が立つ。情に棹させば流される。</p><p style="${style}margin:0;">「おかえり」と、だれかの声がした。</p>`;
  }catch(_){}
}
if(typeof togglePanel === 'function'){
  const _uxOrigTP = togglePanel;
  togglePanel = function(){
    try{ uxPanelSetup(); }catch(e){ console.warn('ux panel', e); }
    const r = _uxOrigTP.apply(this, arguments);
    try{
      const body = document.getElementById('panel-body');
      if(body){ body.classList.toggle('ux-all', !!state.editMode); if(!state.editMode && !body.dataset.uxTab) uxPanelTab('text'); uxPanelRefresh(); }
    }catch(_){}
    return r;
  };
}
// パネルの中の場所へ飛ぶとき（置換ルールなど）は、その場所のタブを開く
(function(){
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function(){
    try{
      const sec = this.closest && this.closest('#panel-body > [data-ux-t]');
      if(sec && sec.dataset.uxT && document.getElementById('panel-body').dataset.uxTab !== sec.dataset.uxT) uxPanelTab(sec.dataset.uxT);
    }catch(_){}
    return orig.apply(this, arguments);
  };
})();
['adjustAllFontSize', 'adjustAllEpisodesFontSize'].forEach(fn => {
  if(typeof window[fn] !== 'function') return;
  const orig = window[fn];
  window[fn] = function(){ const r = orig.apply(this, arguments); setTimeout(uxPanelRefresh, 60); return r; };
});
// 起動したら、メニューを整える
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(uxTidyMenus, 0));
else setTimeout(uxTidyMenus, 0);
/* ══════ 使いやすさここまで ══════ */

/* ══════ 二次創作（タグの1つ目が「二次創作」、2つ目が原作名） ══════ */
const FAN_TAG = '二次創作';
function fanSplit(tags){
  tags = Array.isArray(tags) ? tags.slice() : [];
  if(tags[0] === FAN_TAG && tags[1]) return { fan: true, orig: tags[1], rest: tags.slice(2) };
  return { fan: false, orig: '', rest: tags.filter(t => t !== FAN_TAG) };
}
function fanJoin(fan, orig, rest){
  orig = String(orig || '').replace(/[\s#＃,、，]+/g, '').slice(0, 20);
  rest = (rest || []).filter(t => t && t !== FAN_TAG && t !== orig);
  return (fan && orig ? [FAN_TAG, orig].concat(rest) : rest).slice(0, 8);
}
function workFanHtml(tags){
  const f = fanSplit(tags);
  if(!f.fan) return '';
  return `<div class="work-fan"><span class="work-fan-k">二次創作</span><button onclick='openBrowseTag(${uxEsc(JSON.stringify(f.orig))})'>原作：${uxEsc(f.orig)}</button></div>`;
}
// 作品をさがす：オリジナル／二次創作で分ける（ジャンルとは別）
function fanFilter(works, mode){
  if(mode === 'fan') return works.filter(w => fanSplit(w.tags).fan);
  if(mode === 'orig') return works.filter(w => !fanSplit(w.tags).fan);
  return works;
}
if(typeof BROWSE_SHELVES !== 'undefined' && Array.isArray(BROWSE_SHELVES) && !BROWSE_SHELVES.some(x => x.key === 'fan')){
  const i = BROWSE_SHELVES.findIndex(x => x.key === 'new');
  BROWSE_SHELVES.splice(i >= 0 ? i + 1 : BROWSE_SHELVES.length, 0, { key: 'fan', title: '二次創作', more: { fan: 'fan', sort: 'popular' }, q: { tag: FAN_TAG, sort: 'popular' } });
}
if(typeof coverWithBadges === 'function'){
  const _uxOrigCWB = coverWithBadges;
  coverWithBadges = function(w){
    const h = _uxOrigCWB.apply(this, arguments);
    return w && fanSplit(w.tags).fan ? h.replace(/<\/span>$/, '<span class="wc-fan">二次創作</span></span>') : h;
  };
}
// 作品をさがす：ジャンルなどのボタンを押しても、横のスクロール位置を保つ（押したボタンが見える位置に）
if(typeof renderBrowseList === 'function'){
  const _uxOrigRBL = renderBrowseList;
  renderBrowseList = function(body){
    const keep = {};
    ['.bl-chips', '.bl-seg', '.bl-fan'].forEach(s => { const e = body && body.querySelector(s); if(e) keep[s] = e.scrollLeft; });
    const r = _uxOrigRBL.apply(this, arguments);
    try{
      ['.bl-chips', '.bl-seg', '.bl-fan'].forEach(s => {
        const e = body.querySelector(s); if(!e) return;
        if(keep[s] != null) e.scrollLeft = keep[s];
        const on = e.querySelector('button.on:not(.r18)');
        if(on){
          const a = on.offsetLeft, b = a + on.offsetWidth;
          if(a < e.scrollLeft) e.scrollLeft = Math.max(0, a - 16);
          else if(b > e.scrollLeft + e.clientWidth) e.scrollLeft = b - e.clientWidth + 16;
        }
      });
    }catch(_){}
    return r;
  };
}

/* ══════ 消した本が戻ってこないように ══════ */
// イカ墨翻訳から訳が届く本を消したとき：その作品は「今後は入れない」にする（また届いて本が作り直されるのを防ぐ）
// 消したあとはクラウドにも反映する。あとで欲しくなったら、︙メニューの「イカ墨翻訳で入れない作品」から戻せる
const KZ_SKIPINFO_LS = LS_PREFIX + 'kz-skip-info';   // { 作品のキー: { t: 題名, at } }
function kzSkipInfo(){ try{ return JSON.parse(localStorage.getItem(KZ_SKIPINFO_LS) || '{}') || {}; }catch(_){ return {}; } }
function kzSaveSkipInfo(m){ try{ localStorage.setItem(KZ_SKIPINFO_LS, JSON.stringify(m)); }catch(_){} }
function kzMarkDeleted(ids, titles){
  try{
    if(typeof kzLinkMap !== 'function') return;
    const map = kzLinkMap(), info = kzSkipInfo();
    let ch = false;
    Object.entries(map).forEach(([wk, v]) => { if(ids.includes(v)){ map[wk] = 'skip'; info[wk] = { t: titles[v] || '', at: Date.now() }; ch = true; } });
    if(ch){ kzSaveLinkMap(map); kzSaveSkipInfo(info); try{ kzHello(); }catch(_){} }
  }catch(e){ console.warn('kzMarkDeleted', e); }
}
function uxAfterDelete(before){
  const gone = before.filter(n => !(state.library || []).some(x => x.id === n.id));
  if(!gone.length) return;
  const titles = {}; gone.forEach(n => { titles[n.id] = n.title || ''; });
  kzMarkDeleted(gone.map(n => n.id), titles);
  try{ if(typeof scheduleGdriveAutoSync === 'function') scheduleGdriveAutoSync(); }catch(_){}
}
['deleteNovel', 'deleteSelectedNovels'].forEach(fn => {
  if(typeof window[fn] !== 'function') return;
  const orig = window[fn];
  window[fn] = async function(){
    const before = (state.library || []).map(n => ({ id: n.id, title: n.title }));
    const r = await orig.apply(this, arguments);
    uxAfterDelete(before);
    return r;
  };
});
// 「入れない」の一覧と、また入れる
function kzOpenSkipList(){
  const map = typeof kzLinkMap === 'function' ? kzLinkMap() : {};
  const info = kzSkipInfo();
  const keys = Object.keys(map).filter(k => map[k] === 'skip');
  azSheet(`<div class="az-grab"></div>
    <div class="az-head"><span>イカ墨翻訳で入れない作品</span><button class="az-x" onclick="azClose()" aria-label="閉じる">${AZ_IC.x}</button></div>
    ${keys.length ? `<div class="az-rows">${keys.map(k => `<div class="az-row" style="cursor:default"><span class="az-r-t"><b>${uxEsc((info[k] && info[k].t) || '（題名なし）')}</b><small>${uxEsc(k.length > 40 ? k.slice(0, 40) + '…' : k)}</small></span><button class="az-w-btn" onclick='kzUnskip(${uxEsc(JSON.stringify(k))})'>また入れる</button></div>`).join('')}</div>`
      : '<div class="az-msg">ないよ</div>'}
    <div class="az-foot">${AZ_IC.info}<span>「また入れる」にすると、次にイカ墨翻訳から届いたとき、入れる本を聞きます</span></div>`);
}
function kzUnskip(k){
  const map = kzLinkMap(); delete map[k]; kzSaveLinkMap(map);
  const info = kzSkipInfo(); delete info[k]; kzSaveSkipInfo(info);
  try{ kzHello(); }catch(_){}
  showToast('次に届いたとき、入れる本を聞くね');
  kzOpenSkipList();
}
function uxSkipMenuItem(){
  try{
    const bm = document.getElementById('backup-menu'); if(!bm || typeof kzLinkMap !== 'function') return;
    const n = Object.values(kzLinkMap()).filter(v => v === 'skip').length;
    let it = document.getElementById('ux-kz-skip');
    if(!n){ if(it) it.remove(); return; }
    if(!it){
      const link = [...bm.querySelectorAll('button')].find(b => /openMyWorksModal|openProfileModal/.test(b.getAttribute('onclick') || ''));
      it = document.createElement('button');
      it.id = 'ux-kz-skip';
      it.setAttribute('onclick', 'closeBackupMenu();kzOpenSkipList()');
      it.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;border:none;background:none;padding:10px 16px;font-size:13px;color:#3a6d8c;cursor:pointer;text-align:left;font-family:inherit;';
      (link ? link.parentNode : bm).insertBefore(it, link ? link.nextSibling : null);
    }
    it.innerHTML = `<span style="width:18px;text-align:center;font-weight:700;color:#007070">訳</span>イカ墨翻訳で入れない作品<span style="margin-left:auto;color:#aaa;font-size:11px">${n}</span>`;
  }catch(_){}
}
if(typeof openBackupMenu === 'function'){
  const _uxOrigOBM = openBackupMenu;
  openBackupMenu = function(){ const r = _uxOrigOBM.apply(this, arguments); uxSkipMenuItem(); return r; };
}
