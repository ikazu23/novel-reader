/* ══════ イカ墨翻訳・ムンピアくんから入れた話を消したとき ══════ */
// スクリプトは「イカ墨ノベルに無い話」を送ってくるので、消した話がすぐ送り直されて戻っていた
// （iPhoneでは、確認のOKを押すと画面に戻った合図で送り直されるので、消えないように見えた）。
// ・消した話を本に覚えておき（kzDel：{ 話のキー: { sig, t, num, at } }）、スクリプトには「持っている」と答える
// ・それでも届いたら、入れずに「受け取った」とだけ返す
// ・︙メニューの「イカ墨翻訳で入れない作品・話」から、もとに戻せる
function kzDelBooks(){
  return (state.library || []).map(n => (state.novel && n.id === state.currentNovelId) ? state.novel : n);
}
function kzDelCount(){ return kzDelBooks().reduce((a, n) => a + Object.keys(n.kzDel || {}).length, 0); }
function kzDelSave(n){
  if(state.novel && n === state.novel){
    const i = state.library.findIndex(x => x.id === n.id);
    if(i >= 0) state.library[i] = novelSnapshot(state.novel);
  }
  return libDbPut(n).catch(e => console.warn('kzDel save', e));
}
if(typeof deleteEpisode === 'function'){
  const _kzdOrigDel = deleteEpisode;
  deleteEpisode = function(id){
    try{
      const n = state.novel, ep = n && (n.episodes || []).find(e => e.id === id);
      const k = ep && ep.kzImport && ep.kzImport.key;
      if(k){
        n.kzDel = Object.assign({}, n.kzDel || {});
        n.kzDel[k] = { sig: ep.kzImport.sv === 2 ? String(ep.kzImport.sig || '') : '', t: ep.title || '', num: ep.number, at: new Date().toISOString() };
      }
    }catch(_){}
    return _kzdOrigDel.apply(this, arguments);
  };
}
// スクリプトに教える「持っている話」に、消した話も入れる（指紋がわからない話は、一度届いたときに覚える）
if(typeof kzHave === 'function'){
  const _kzdOrigHave = kzHave;
  kzHave = function(){
    const r = _kzdOrigHave.apply(this, arguments);
    try{
      kzDelBooks().forEach(n => Object.entries(n.kzDel || {}).forEach(([k, v]) => { if(r.have && !r.have[k]) r.have[k] = [(v && v.sig) || '?', '']; }));
    }catch(_){}
    return r;
  };
}
// 届いた話のうち、消した話は入れない（受け取ったことだけ返す）
if(typeof kzReceive === 'function'){
  const _kzdOrigRecv = kzReceive;
  kzReceive = async function(eps){
    try{
      const acks = [], keep = [], changed = new Set();
      (eps || []).forEach(p => {
        const n = p && p.key && kzDelBooks().find(b => b.kzDel && b.kzDel[p.key]);
        if(!n){ keep.push(p); return; }
        const d = n.kzDel[p.key];
        if(p.sig && d.sig !== String(p.sig)){ d.sig = String(p.sig); changed.add(n); }
        acks.push({ key: p.key, n: p.n || 0, h: p.h || '', sig: p.sig || '' });
      });
      changed.forEach(n => kzDelSave(n));
      if(acks.length) kzLinkPost({ type: 'ack', items: acks });
      if(!keep.length) return;
      eps = keep;
    }catch(e){ console.warn('kzDel recv', e); }
    return _kzdOrigRecv.call(this, eps);
  };
}
// もとに戻す：次にスクリプトから届いたとき、また入る
function kzDelRestore(bookId, key){
  const n = kzDelBooks().find(b => b.id === bookId);
  if(!n || !n.kzDel || !n.kzDel[key]) return;
  delete n.kzDel[key];
  if(!Object.keys(n.kzDel).length) delete n.kzDel;
  n.updatedAt = new Date().toISOString();
  kzDelSave(n);
  try{ scheduleGdriveAutoSync(); }catch(_){}
  try{ kzHello(); }catch(_){}
  showToast('次にスクリプトから届いたとき、この話をまた入れるね');
  try{ kzOpenSkipList(); }catch(_){}
}
function kzDelListHtml(){
  const rows = [];
  kzDelBooks().forEach(n => Object.entries(n.kzDel || {}).forEach(([k, v]) => {
    rows.push(`<div class="az-row" style="cursor:default"><span class="az-r-t"><b>${uxEsc((v.num != null ? v.num + '話 ' : '') + (v.t || '（題名なし）'))}</b><small>${uxEsc(n.title || '')}</small></span><button class="az-w-btn" onclick='kzDelRestore(${uxEsc(JSON.stringify(n.id))},${uxEsc(JSON.stringify(k))})'>戻す</button></div>`);
  }));
  return rows;
}
/* ══════ 消した話ここまで ══════ */
