/* ══════ 端末の保存場所（IndexedDB）の直し ══════ */
// iPhone（Safari）は、アプリを裏に回していると保存場所とのつながりが切れることがある。
// 今までは最初のつながりをずっと使っていたので、切れたあとは保存・削除がこっそり失敗していた
// （画面からは消えているのに端末には残っていて、開き直すと本が戻る）。
// ・つながりが切れたら、つなぎ直してもう一度やる
// ・途中で止まった（abort）・返事がないときも、失敗として扱う
// ・本を消すときは「消した記録」を残す。消しきれなかった本は、次に開いたときに消す
const DB_OP_TIMEOUT = 20000;
let _dbHadSet = false;
function dbResetConn(){ try{ if(_db) _db.close(); }catch(_){} _db = null; }
if(typeof openDB === 'function'){
  const _dbOrigOpen = openDB;
  openDB = function(){
    return _dbOrigOpen.apply(this, arguments).then(db => {
      if(db && !db._fx){
        db._fx = 1;
        db.onclose = () => { if(_db === db) _db = null; };
        db.onversionchange = () => { try{ db.close(); }catch(_){} if(_db === db) _db = null; };
      }
      return db;
    });
  };
}
// 1回分の読み書き。終わった（complete）ときだけ成功。エラー・中断・返事なしは失敗
function dbTx(store, mode, fn, timeout){
  return openDB().then(db => new Promise((resolve, reject) => {
    let done = false, req;
    const tm = setTimeout(() => fin(false, new Error('保存場所から返事がありません')), timeout || DB_OP_TIMEOUT);
    function fin(ok, v){ if(done) return; done = true; clearTimeout(tm); ok ? resolve(v) : reject(v); }
    let tx;
    try{ tx = db.transaction(store, mode); req = fn(tx.objectStore(store)); }
    catch(e){ fin(false, e); return; }
    tx.oncomplete = () => fin(true, req ? req.result : undefined);
    tx.onerror = () => fin(false, tx.error || new Error('保存場所のエラー'));
    tx.onabort = () => fin(false, tx.error || new Error('途中で止まりました'));
  }));
}
// 失敗したら、つなぎ直してもう1回
async function dbRetry(op){
  try{ return await op(); }
  catch(e){
    console.warn('IndexedDB: retry after', e);
    dbResetConn();
    return await op();
  }
}
if(typeof libDbPut === 'function'){
  libDbPut = function(novel){
    if(novel && novel.trial) return Promise.resolve(); // 試し読みは本棚に保存しない
    return dbRetry(() => dbTx(DB_LIBRARY_STORE, 'readwrite', s => { s.put(novel, novel.id); })).then(() => { if(!_dbHadSet){ _dbHadSet = true; dbMarkHad(true); } });
  };
}
// 前に本があった端末で、本棚が空に見えたとき（iPhoneの起動直後など）は、つなぎ直して読み直す
const DB_HAD_LS = LS_PREFIX + 'had-books';
function dbMarkHad(on){ try{ if(on) localStorage.setItem(DB_HAD_LS, '1'); else localStorage.removeItem(DB_HAD_LS); }catch(_){} }
if(typeof libDbGetAll === 'function'){
  libDbGetAll = async function(){
    const get = () => dbRetry(() => dbTx(DB_LIBRARY_STORE, 'readonly', s => s.getAll(), 60000)).then(r => r || []);
    let r = await get();
    let had = false; try{ had = localStorage.getItem(DB_HAD_LS) === '1'; }catch(_){}
    for(let i = 0; !r.length && had && i < 2; i++){
      await new Promise(res => setTimeout(res, 300 + i * 500));
      dbResetConn();
      r = await get();
    }
    if(r.length) dbMarkHad(true);
    return r;
  };
}
if(typeof libDbDelete === 'function'){
  libDbDelete = async function(novelId){
    // 先に「消した記録」（すでにあれば、前の時刻のまま）
    try{ const m = gdDelMap(); if(novelId && !m[novelId]){ m[novelId] = gdNow(); gdSaveDel(m); } }catch(_){}
    try{
      await dbRetry(() => dbTx(DB_LIBRARY_STORE, 'readwrite', s => { s.delete(novelId); }));
      if(state && Array.isArray(state.library) && !state.library.some(n => n && n.id !== novelId)) dbMarkHad(false);
    }catch(e){
      console.warn('libDbDelete failed', e);
      try{ showToast('この端末からうまく消せませんでした。次に開いたときにもう一度消します'); }catch(_){}
    }
  };
}
// 起動したとき：「消した記録」があるのに端末に残っている本を消す
if(typeof loadLibrary === 'function'){
  const _dbOrigLoad = loadLibrary;
  loadLibrary = async function(){
    const r = await _dbOrigLoad.apply(this, arguments);
    try{
      const m = gdDelMap();
      const gone = (state.library || []).filter(n => n && m[n.id] && !((n.rv || '') > m[n.id]));
      if(gone.length){
        for(const n of gone) await libDbDelete(n.id);
        state.library = state.library.filter(n => !gone.includes(n));
        console.info('消した本を片づけました:', gone.map(n => n.title));
      }
    }catch(e){ console.warn('cleanup deleted', e); }
    // 前に勝手に作られた、空っぽの「無題の小説」：ほかに本があれば、1日たったものから片づける
    try{
      const old = new Date(Date.now() - 864e5).toISOString();
      if((state.library || []).some(n => !gdIsBlank(n))){
        const blank = state.library.filter(n => gdIsBlank(n) && (n.updatedAt || '') < old);
        for(const n of blank) await libDbDelete(n.id);
        if(blank.length) state.library = state.library.filter(n => !blank.includes(n));
      }
    }catch(e){ console.warn('cleanup blank', e); }
    // 端末に「このデータは消さないで」とお願いする（iPhoneなどで、しばらく開かないと消されるのを防ぐ）
    try{
      if(navigator.storage && navigator.storage.persist && !/Firefox/i.test(navigator.userAgent)){
        navigator.storage.persisted().then(p => { if(!p) return navigator.storage.persist(); }).catch(() => {});
      }
    }catch(_){}
    return r;
  };
}
// 共有作品は、消してから追加し直しても同じIDになる → 追加し直したら「消した記録」を取り消す
if(typeof addWorkToLibrary === 'function'){
  const _dbOrigAddWork = addWorkToLibrary;
  addWorkToLibrary = async function(workId){
    const nid = 'shared_' + workId;
    const had = (state.library || []).some(n => n.id === nid);
    const r = await _dbOrigAddWork.apply(this, arguments);
    try{
      const m = gdDelMap();
      const n = (state.library || []).find(x => x.id === nid);
      if(!had && n && m[nid]){
        delete m[nid]; gdSaveDel(m);
        n.rv = gdNow();
        const cur = state.novel && state.novel.id === nid;
        if(cur) state.novel.rv = n.rv;
        await libDbPut(cur ? state.novel : n);
        try{ scheduleGdriveAutoSync(); }catch(_){}
      }
    }catch(_){}
    return r;
  };
}
// 中身が空っぽの「無題の小説」か（書いた文字・挿絵・表紙・作者・訳が何もない）
function gdIsBlank(n){
  if(!n || (n.title || '無題の小説') !== '無題の小説' || n.author || n.cover || n.ext || n.shared || n.publish || n.trial) return false;
  if(['koTr', 'koNotes', 'koSense'].some(f => n[f] && Object.keys(n[f]).length)) return false;
  const eps = n.episodes || [];
  if(eps.length > 1) return false;
  return eps.every(e => !e.charCount && !e.kzImport && (e.pages || []).every(pg => (pg.paras || []).every(pa =>
    (!pa.type || pa.type === 'text') && !String(pa.text || '').trim() && !String(pa.html || '').replace(/<[^>]*>|&nbsp;/g, '').trim())));
}
// 本棚が空のときの一言
if(typeof renderLibrary === 'function'){
  const _dbOrigRender = renderLibrary;
  renderLibrary = function(){
    const r = _dbOrigRender.apply(this, arguments);
    try{
      const grid = document.getElementById('library-grid');
      if(grid && !(state.library || []).length && !grid.querySelector('.lib-empty')){
        const d = document.createElement('div');
        d.className = 'lib-empty';
        d.innerHTML = '<b>本棚はからっぽだよ</b><span>右下の ＋ から、名作を読んだり<br>新しい本を書いたりできるよ</span>';
        grid.appendChild(d);
      }
    }catch(_){}
    return r;
  };
}
/* ══════ 端末の保存場所の直しここまで ══════ */
