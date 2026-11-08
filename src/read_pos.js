/* ══════ 読んでいた場所を覚える・横スワイプの判定（iPhone） ══════ */
// iPhoneは、ほかのアプリを使っている間にページを止めて、戻ったときに読み込み直すことがある。
// そのとき話の最初（本棚）に戻っていたので、読んでいた場所（ページ・区切り・スクロール）を覚えて戻す。
// ・iPhoneで読み込み直されたとき（30分以内）は、読んでいた話のその場所を自動で開き直す
// ・「続きから読む」で開いたときも、前に読んでいた場所から（どの端末でも）
// ・iPhoneは縦にスクロールするとき指がななめに動くので、横スワイプ（ページめくり・次の話）の判定を厳しくする
const RP_LS = LS_PREFIX + 'read-pos';          // 最後に読んでいた場所 { nid, eid, page, group, top, at, reading }
const RP_MAP_LS = LS_PREFIX + 'read-pos-map';  // 本ごとの読んでいた場所 { nid: { eid, page, group, top, at } }
const RP_RELOAD_MS = 30 * 60 * 1000;
function rpIOS(){ try{ return typeof iosIs === 'function' && iosIs(); }catch(_){ return false; } }
function rpGet(k){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(_){ return null; } }
function rpSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} }
function rpNow(){
  if(!state.currentNovelId || !state.currentEpisodeId || !state.novel || state.editMode) return null;
  if(state.novel.trial) return null;
  const pi = state.curPage || 0;
  const pageEl = document.getElementById('page-' + pi);
  return { nid: state.currentNovelId, eid: state.currentEpisodeId, page: pi, group: state.subPageIndex || 0, top: pageEl ? Math.round(pageEl.scrollTop) : 0, at: Date.now() };
}
let _rpLastStr = '';
function rpSave(reading){
  try{
    const p = rpNow(); if(!p) return;
    const str = JSON.stringify([p.nid, p.eid, p.page, p.group, p.top, reading]);
    if(str === _rpLastStr) return;
    _rpLastStr = str;
    rpSet(RP_LS, Object.assign({}, p, { reading: reading !== false }));
    const m = rpGet(RP_MAP_LS) || {};
    m[p.nid] = { eid: p.eid, page: p.page, group: p.group, top: p.top, at: p.at };
    const ks = Object.keys(m);
    if(ks.length > 300) ks.sort((a, b) => (m[a].at || 0) - (m[b].at || 0)).slice(0, ks.length - 300).forEach(k => delete m[k]);
    rpSet(RP_MAP_LS, m);
  }catch(_){}
}
let _rpT = 0;
document.addEventListener('scroll', e => {
  const t = e.target;
  if(!t || !t.classList || !t.classList.contains('page') || !state.currentEpisodeId) return;
  clearTimeout(_rpT); _rpT = setTimeout(() => rpSave(true), 600);
}, true);
setInterval(() => { if(state.currentEpisodeId && document.visibilityState === 'visible') rpSave(true); }, 5000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') rpSave(true); });
window.addEventListener('pagehide', () => rpSave(true));
// 自分で目次・本棚に戻ったときは「読んでいる最中」ではない（場所は覚えておく）
['showToc', 'showLibrary'].forEach(fn => {
  if(typeof window[fn] !== 'function') return;
  const orig = window[fn];
  window[fn] = function(){
    try{
      if(state.currentEpisodeId){ _rpLastStr = ''; rpSave(false); }
      else { const l = rpGet(RP_LS); if(l && l.reading){ l.reading = false; rpSet(RP_LS, l); } }
    }catch(_){}
    return orig.apply(this, arguments);
  };
});

// ── 場所に戻す ──
function rpApply(p){
  if(!p) return;
  setTimeout(() => {
    try{
      if(state.currentEpisodeId !== p.eid || !state.pages) return;
      const pi = Math.max(0, Math.min(p.page || 0, state.pages.length - 1));
      const fin = () => {
        try{
          if(state.currentEpisodeId !== p.eid) return;
          const pageEl = document.getElementById('page-' + pi); if(!pageEl) return;
          const gs = pageEl.querySelectorAll('.subpage-group');
          if(p.group > 0 && p.group < gs.length && typeof switchToGroup === 'function') switchToGroup(pi, p.group, false);
          const set = () => { if(state.currentEpisodeId === p.eid && state.curPage === pi) pageEl.scrollTop = Math.min(p.top || 0, Math.max(0, pageEl.scrollHeight - pageEl.clientHeight)); };
          set(); setTimeout(set, 300); setTimeout(set, 900);
        }catch(_){}
      };
      if(pi !== state.curPage && typeof goToPage === 'function'){ goToPage(pi); setTimeout(fin, 500); } else fin();
    }catch(e){ console.warn('read pos', e); }
  }, 150);
}
function rpWorth(p){ return p && ((p.page || 0) > 0 || (p.group || 0) > 0 || (p.top || 0) > 40); }
let _rpWant = null;
if(typeof openEpisode === 'function'){
  const _rpOrigOpen = openEpisode;
  openEpisode = function(id){
    const r = _rpOrigOpen.apply(this, arguments);
    try{
      if(_rpWant && _rpWant.eid === id && Date.now() - _rpWant.t < 15000){ const w = _rpWant; _rpWant = null; rpApply(w); }
    }catch(_){}
    return r;
  };
}
// 「続きから読む」：前に読んでいた場所から
function rpWantFor(nid, eid){
  const m = rpGet(RP_MAP_LS) || {}, p = m[nid];
  _rpWant = (p && p.eid === eid && rpWorth(p)) ? Object.assign({ t: Date.now() }, p) : null;
}
if(typeof resumeLastEpisode === 'function'){
  const _rpOrigResume = resumeLastEpisode;
  resumeLastEpisode = function(){
    try{ if(typeof _resumeNovelId !== 'undefined' && _resumeNovelId && _resumeEpId) rpWantFor(_resumeNovelId, _resumeEpId); }catch(_){}
    return _rpOrigResume.apply(this, arguments);
  };
}
if(typeof uxOpenEp === 'function'){
  const _rpOrigUxOpen = uxOpenEp;
  uxOpenEp = function(id){
    try{ if(state.currentNovelId && state.novel && state.novel.lastReadId === id) rpWantFor(state.currentNovelId, id); }catch(_){}
    return _rpOrigUxOpen.apply(this, arguments);
  };
}
// iPhoneで読み込み直されたとき：読んでいた話のその場所を開き直す
(function rpAutoReopen(){
  if(!rpIOS()) return;
  const last = rpGet(RP_LS);
  if(!last || !last.reading || Date.now() - (last.at || 0) > RP_RELOAD_MS) return;
  if(/[?&](work|share|w)=/.test(location.search) || location.hash.length > 1) return;
  const t0 = Date.now();
  const tick = () => {
    try{
      if(Date.now() - t0 > 8000) return;
      const ready = state.library && state.library.length && document.getElementById('library-screen') && document.getElementById('library-screen').classList.contains('show');
      if(!ready){ setTimeout(tick, 200); return; }
      if(state.currentNovelId) return;   // もう自分で何か開いた
      const n = state.library.find(x => x.id === last.nid);
      if(!n || !(n.episodes || []).some(e => e.id === last.eid)) return;
      _resumeNovelId = last.nid; _resumeEpId = last.eid;
      _rpWant = Object.assign({ t: Date.now() }, last);
      Promise.resolve(_rpOrigResumeRef()).then(() => { try{ showToast('読んでいたところに戻りました'); }catch(_){} }).catch(() => {});
    }catch(e){ console.warn('read pos reopen', e); }
  };
  setTimeout(tick, 300);
})();
function _rpOrigResumeRef(){ return resumeLastEpisode(); }

// ── 横スワイプ：iPhoneは厳しめに（ほかの端末は今まで通り） ──
let _rpTouch = { y0: 0, maxDy: 0 };
document.addEventListener('touchstart', e => { if(e.touches.length === 1){ _rpTouch = { y0: e.touches[0].clientY, maxDy: 0 }; } }, { passive: true, capture: true });
document.addEventListener('touchmove', e => { if(e.touches.length === 1){ const d = Math.abs(e.touches[0].clientY - _rpTouch.y0); if(d > _rpTouch.maxDy) _rpTouch.maxDy = d; } }, { passive: true, capture: true });
function rpSwipeOk(dx, dy, startX, scrolled){
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if(!rpIOS()) return ax > ay * 1.5 && ax > 50;
  if(ax < 80 || ax < ay * 2.5) return false;               // しっかり横に
  if(Math.abs(scrolled || 0) > 8) return false;            // 指を動かす間に縦にスクロールしていたら、スクロール
  if(_rpTouch.maxDy > 40) return false;                    // 途中で縦に大きく動いていたら、スクロール
  const w = window.innerWidth || 400;
  if(startX < 24 || startX > w - 24) return false;         // 画面の端から（iPhoneの「戻る」操作）
  return true;
}
/* ══════ 読んでいた場所・横スワイプここまで ══════ */
