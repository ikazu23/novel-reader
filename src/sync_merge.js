/* ══════ 本棚の同期：混ぜ合わせる ══════ */
// 今までは「最後に同期した端末の本棚」でクラウドを丸ごと上書きしていたので、
// ほかの端末の同期で、消した本が戻ったり、足した話が消えたりした。
// ・本ごと・話ごとに、クラウドと端末を比べて新しいほうを残す（片方にしかない本・話は両方に入れる）
// ・消した本・消した話は「いつ消したか」を記録して、それより古いものはほかの端末からも消す
// ・クラウドが前に見たときから変わっていなければ、ダウンロードしない（軽くするため）
const GD_DEL_LS = LS_PREFIX + 'gd-deleted';        // { 本のID: 消した時刻 }
const GD_SEEN_LS = LS_PREFIX + 'gd-remote-seen';   // 最後に見た（上げた）クラウドのファイルの更新時刻
const GD_KEEP_DAYS = 180;
function gdNow(){ return new Date().toISOString(); }
function gdMax(a, b){ return (a || '') > (b || '') ? (a || '') : (b || ''); }
function gdDelMap(){ try{ return JSON.parse(localStorage.getItem(GD_DEL_LS) || '{}') || {}; }catch(_){ return {}; } }
function gdPrune(m){
  const old = new Date(Date.now() - GD_KEEP_DAYS * 864e5).toISOString();
  Object.keys(m || {}).forEach(k => { if(!m[k] || m[k] < old) delete m[k]; });
  return m || {};
}
function gdSaveDel(m){ try{ localStorage.setItem(GD_DEL_LS, JSON.stringify(gdPrune(m))); }catch(_){} }
function gdMergeDel(a, b){ const m = Object.assign({}, a || {}); Object.entries(b || {}).forEach(([k, v]) => { m[k] = gdMax(m[k], v); }); return gdPrune(m); }
// 話の版：中身を直した時刻（u）か、入れた・更新した時刻（date）の新しいほう
function gdEpVer(e){ return gdMax(e && e.u, e && e.date); }
// 話の中身の指紋（直したかどうかを見分ける）
function gdSig(pages){
  const s = JSON.stringify(pages || []);
  let h = 5381; for(let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + '.' + s.length;
}

// ── 1冊を混ぜ合わせる（keepEpId の話は端末のものを残す：いま開いている話） ──
function gdMergeNovel(l, r, keepEpId){
  const rNewer = (r.updatedAt || '') > (l.updatedAt || '');
  const base = rNewer ? r : l, other = rNewer ? l : r;
  const m = Object.assign({}, base);
  const del = gdMergeDel(l.delEps, r.delEps);
  const byId = new Map();
  (l.episodes || []).forEach(e => byId.set(e.id, e));
  (r.episodes || []).forEach(e => {
    const cur = byId.get(e.id);
    if(!cur){ byId.set(e.id, e); return; }
    if(e.id === keepEpId) return;
    if(gdEpVer(e) > gdEpVer(cur)) byId.set(e.id, e);
  });
  m.episodes = [...byId.values()].filter(e => e.id === keepEpId || !(del[e.id] && del[e.id] >= gdEpVer(e)));
  if(Object.keys(del).length) m.delEps = del; else delete m.delEps;
  // 韓国語メモの訳・メモは、両方を合わせる（同じ段落は新しいほうの本のもの）
  ['koTr', 'koNotes', 'koSense'].forEach(f => { if(l[f] || r[f]) m[f] = Object.assign({}, other[f] || {}, base[f] || {}); });
  if(m.lastReadId && !m.episodes.some(e => e.id === m.lastReadId)) m.lastReadId = (other.lastReadId && m.episodes.some(e => e.id === other.lastReadId)) ? other.lastReadId : null;
  m.updatedAt = gdMax(l.updatedAt, r.updatedAt);
  if(l.rv || r.rv) m.rv = gdMax(l.rv, r.rv);
  return m;
}
function gdSameNovel(a, b){
  if(a === b) return true;
  if((a.updatedAt || '') !== (b.updatedAt || '')) return false;
  const ea = a.episodes || [], eb = b.episodes || [];
  if(ea.length !== eb.length) return false;
  for(let i = 0; i < ea.length; i++){ if(ea[i].id !== eb[i].id || gdEpVer(ea[i]) !== gdEpVer(eb[i]) || ea[i].charCount !== eb[i].charCount) return false; }
  return JSON.stringify(a.delEps || {}) === JSON.stringify(b.delEps || {});
}

// ── 本棚全体を混ぜ合わせる。戻り値：{ added, updated, removed } ──
async function gdMergeLibrary(remote, opt){
  opt = opt || {};
  const rlib = (remote && Array.isArray(remote.library)) ? remote.library : [];
  const del = gdMergeDel(gdDelMap(), remote && remote.deleted);
  const curId = state.currentNovelId;
  const local = new Map((state.library || []).map(n => [n.id, n]));
  const out = [];
  let added = 0, updated = 0, removed = 0;
  const seen = new Set();
  const handle = async (id, l, r) => {
    let n = l && r ? gdMergeNovel(l, r, id === curId ? state.currentEpisodeId : null) : (l || r);
    const t = del[id];
    // 消した本は、ほかの端末で読まれていても消す（バックアップから戻した本＝rv が消した時刻より後、だけは残す）
    if(t && !((n.rv || '') > t)){
      if(id !== curId){
        if(l){ removed++; try{ await libDbDelete(id); }catch(_){} }
        return;
      }
      // いま開いている本：開いている間は消さない（閉じたあとの同期・次に開いたときに消える）
      if(l) out.push(l);
      return;
    }
    if(t && (n.rv || '') > t) delete del[id];
    if(l && r && gdSameNovel(n, l)) n = l;
    if(!l){ added++; await libDbPut(n); }
    else if(n !== l){
      updated++;
      if(id === curId && state.novel){
        // いま開いている本：開いている話はそのまま、ほかの話・情報を入れる
        const keep = state.currentEpisodeId && (state.novel.episodes || []).find(e => e.id === state.currentEpisodeId);
        Object.keys(n).forEach(k => { if(k !== 'episodes') state.novel[k] = n[k]; });
        state.novel.episodes = n.episodes.map(e => (keep && e.id === keep.id) ? keep : e);
        n = typeof novelSnapshot === 'function' ? novelSnapshot(state.novel) : state.novel;
        await libDbPut(state.novel);
      }else await libDbPut(n);
    }
    out.push(n);
  };
  for(const r of rlib){
    if(!r || !r.id || seen.has(r.id)) continue;
    // 新しい同期になって初めての同期：この端末にない本は「前にこの端末で消した本」かもしれないので入れない（今までどおり）
    if(opt.noRemoteOnly && !local.has(r.id)) continue;
    if(!local.has(r.id) && typeof gdIsBlank === 'function' && gdIsBlank(r)) continue; // ほかの端末の空っぽの無題の本は入れない
    seen.add(r.id); await handle(r.id, local.get(r.id), r);
  }
  for(const [id, l] of local){ if(seen.has(id)) continue; seen.add(id); await handle(id, l, null); }
  state.library = out;
  gdSaveDel(del);
  return { added, updated, removed };
}
function gdAfterMerge(res){
  if(!res || !(res.added || res.updated || res.removed)) return;
  try{
    if(document.getElementById('library-screen') && document.getElementById('library-screen').classList.contains('show')) renderLibrary();
    else if(state.currentNovelId && !state.currentEpisodeId && typeof renderToc === 'function') renderToc();
  }catch(_){}
}
// アップロードの前に呼ばれる：クラウドがほかの端末で変わっていたら、取り込んでから上げる
async function gdBeforeUpload(existing){
  if(!existing) return null;
  const seen = localStorage.getItem(GD_SEEN_LS);
  if(seen && existing.modifiedTime && seen === existing.modifiedTime) return null;
  const res = await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + existing.id + '?alt=media');
  let data = null;
  try{ data = await res.json(); }catch(e){ console.warn('cloud data broken, skip merge', e); return null; }
  // この端末が前の版で同期したことがあって、新しい同期は初めて → この端末の本棚を正にする
  const first = !seen && !!localStorage.getItem(LS_LAST_SYNC);
  const r = await gdMergeLibrary(data, { noRemoteOnly: first });
  gdAfterMerge(r);
  return r;
}
async function gdAfterUpload(){
  try{ const f = await gdriveFindFile(); if(f && f.modifiedTime) localStorage.setItem(GD_SEEN_LS, f.modifiedTime); }catch(_){}
}
function gdPayloadExtra(){ return { deleted: gdDelMap() }; }

// ── 消した本・消した話を記録する ──
function gdRecordDeleted(ids){
  const m = gdDelMap(), t = gdNow();
  ids.forEach(id => { m[id] = t; });
  gdSaveDel(m);
}
['deleteNovel', 'deleteSelectedNovels'].forEach(fn => {
  if(typeof window[fn] !== 'function') return;
  const orig = window[fn];
  window[fn] = async function(){
    const before = (state.library || []).map(n => n.id);
    const r = await orig.apply(this, arguments);
    const gone = before.filter(id => !(state.library || []).some(n => n.id === id));
    if(gone.length){ gdRecordDeleted(gone); try{ scheduleGdriveAutoSync(); }catch(_){} }
    return r;
  };
});
if(typeof deleteEpisode === 'function'){
  const _gdOrigDelEp = deleteEpisode;
  deleteEpisode = function(id){
    try{ if(state.novel){ state.novel.delEps = gdPrune(Object.assign({}, state.novel.delEps || {}, { [id]: gdNow() })); } }catch(_){}
    return _gdOrigDelEp.apply(this, arguments);
  };
}
// 話を開いたときの中身を覚えておき、直したら「直した時刻」を付ける
if(typeof openEpisode === 'function'){
  const _gdOrigOpenEp = openEpisode;
  openEpisode = function(id){
    const r = _gdOrigOpenEp.apply(this, arguments);
    try{ const ep = state.novel && state.novel.episodes.find(e => e.id === state.currentEpisodeId); if(ep) ep._sig = gdSig(ep.pages); }catch(_){}
    return r;
  };
}
if(typeof syncCurrentEpisode === 'function'){
  const _gdOrigSync = syncCurrentEpisode;
  syncCurrentEpisode = function(){
    const r = _gdOrigSync.apply(this, arguments);
    try{
      const ep = state.currentEpisodeId && state.novel && state.novel.episodes.find(e => e.id === state.currentEpisodeId);
      if(ep){
        const s = gdSig(ep.pages);
        if(ep._sig && ep._sig !== s) ep.u = gdNow();
        ep._sig = s;
      }
    }catch(_){}
    return r;
  };
}
// バックアップから本を戻したときは「消した記録」を取り消す（ほかの端末でも戻るように）
if(typeof restoreFromBackup === 'function'){
  const _gdOrigRestoreBk = restoreFromBackup;
  restoreFromBackup = async function(novelId){
    const r = await _gdOrigRestoreBk.apply(this, arguments);
    try{
      const m = gdDelMap();
      let n = (state.library || []).find(x => x.id === novelId);
      if(!n){ n = ((await libDbGetAll()) || []).find(x => x.id === novelId); if(n && state.library){ state.library.push(n); try{ renderLibrary(); }catch(_){} } }
      if(n && n.updatedAt && (Date.now() - new Date(n.updatedAt).getTime()) < 60000){
        n.rv = gdNow();
        if(state.novel && state.novel.id === novelId) state.novel.rv = n.rv;
        await libDbPut(n);
        if(m[novelId]){ delete m[novelId]; gdSaveDel(m); }
        try{ scheduleGdriveAutoSync(); }catch(_){}
      }
    }catch(_){}
    return r;
  };
}
// ── 「クラウドから復元」も、混ぜ合わせる形に ──
if(typeof gdriveRestoreFromCloud === 'function'){
  gdriveRestoreFromCloud = async function(){
    if(!gdriveIsSignedIn()){ gdriveSignIn(); return; }
    if(!confirm('クラウドの本棚と、この端末の本棚を合わせますか？\n\n・新しいほうの本・話を残します\n・ほかの端末で消した本は、この端末でも消えます\n・今の状態は自動バックアップに残ります')) return;
    try{
      showToast('クラウドを読み込み中...');
      if(state.editMode){ try{ syncEditorToState(state.curPage); }catch(_){} syncCurrentEpisode(); }
      const f = await gdriveFindFile();
      if(!f){ showToast('クラウドにデータがありません'); return; }
      const data = await (await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media')).json();
      if(!data || !data.library){ showToast('クラウドにデータがありません'); return; }
      if(state.library){ for(const novel of state.library) await autoBackup(novel, true, true); }
      const r = await gdMergeLibrary(data);
      if(f.modifiedTime) localStorage.setItem(GD_SEEN_LS, f.modifiedTime);
      if(data.settings){
        const keepKey = state.settings.ttsApiKey;
        state.settings = Object.assign({}, state.settings, data.settings);
        if(keepKey) state.settings.ttsApiKey = keepKey;
        try{ debouncedSaveSettings(); }catch(_){}
      }
      if(state.editMode) exitEditMode();
      state.currentNovelId = null;
      state.currentEpisodeId = null;
      showLibrary();
      try{ await koSyncWords(); }catch(e){ console.warn('ko sync', e); }
      showToast(`クラウドと合わせました（追加${r.added}冊・更新${r.updated}冊・削除${r.removed}冊）`);
      // 合わせた結果をクラウドにも
      try{ scheduleGdriveAutoSync(); }catch(_){}
    }catch(e){
      console.warn('gdriveRestoreFromCloud:', e);
      showToast('復元失敗：' + e.message);
    }
  };
}
/* ══════ 本棚の同期：混ぜ合わせるここまで ══════ */
