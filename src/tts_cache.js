/* ══════ 読み上げ音声の保存 ══════ */
// Googleの高音質読み上げで作った音声を端末に保存して、同じ本文・同じ声なら保存したものを使う（2回目からはお金がかからない）
// 速さは再生するときに変えているので、速さが違っても同じ音声を使える
const TTSC_DB = 'novel-reader-tts' + (typeof LS_PREFIX !== 'undefined' && LS_PREFIX ? '-' + LS_PREFIX.replace(/-$/, '') : '');
const TTSC_CAP = 300 * 1024 * 1024;   // 300MBまで（古く使ったものから消す）
let _ttscDb = null;
function ttscOpen(){
  if(_ttscDb) return _ttscDb;
  _ttscDb = new Promise((res, rej) => {
    const r = indexedDB.open(TTSC_DB, 1);
    r.onupgradeneeded = () => { const db = r.result; if(!db.objectStoreNames.contains('a')) db.createObjectStore('a'); if(!db.objectStoreNames.contains('m')) db.createObjectStore('m'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }).catch(e => { _ttscDb = null; throw e; });
  return _ttscDb;
}
function ttscReq(store, mode, fn){
  return ttscOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction(store, mode), st = tx.objectStore(store);
    let out; const q = fn(st); if(q) q.onsuccess = () => { out = q.result; };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
async function ttscKey(voice, text){
  const s = voice + '|' + text;
  try{
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }catch(_){ let h = 5381; for(let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return 'h' + h.toString(36) + '_' + s.length; }
}
async function ttscGet(k){
  const d = await ttscReq('a', 'readonly', st => st.get(k));
  if(d) ttscReq('m', 'readwrite', st => st.put({ n: d.length, t: Date.now() }, k)).catch(() => {});
  return d || null;
}
async function ttscPut(k, data){
  await ttscReq('a', 'readwrite', st => st.put(data, k));
  await ttscReq('m', 'readwrite', st => st.put({ n: data.length, t: Date.now() }, k));
  ttscPrune().catch(() => {});
}
async function ttscList(){
  const out = [];
  await ttscReq('m', 'readonly', st => { const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if(cur){ out.push({ k: cur.key, n: cur.value.n || 0, t: cur.value.t || 0 }); cur.continue(); } }; return null; });
  return out;
}
async function ttscPrune(){
  const list = await ttscList();
  let total = list.reduce((a, x) => a + x.n, 0);
  if(total <= TTSC_CAP) return;
  list.sort((a, b) => a.t - b.t);
  const del = [];
  for(const x of list){ if(total <= TTSC_CAP * 0.9) break; total -= x.n; del.push(x.k); }
  await ttscReq('a', 'readwrite', st => { del.forEach(k => st.delete(k)); return null; });
  await ttscReq('m', 'readwrite', st => { del.forEach(k => st.delete(k)); return null; });
}
async function ttscSize(){ try{ return (await ttscList()).reduce((a, x) => a + x.n, 0); }catch(_){ return 0; } }
async function ttscClear(){
  if(!confirm('保存した読み上げの音声を全部消しますか？\n（次に聞くときは、また音声を作り直します）')) return;
  try{ await ttscReq('a', 'readwrite', st => st.clear()); await ttscReq('m', 'readwrite', st => st.clear()); }catch(_){}
  ttscPanelRefresh();
  showToast('保存した音声を消しました');
}
if(typeof synthesizeChirp === 'function'){
  const _ttscOrig = synthesizeChirp;
  synthesizeChirp = async function(text){
    const voice = (state.settings && state.settings.ttsVoice) || 'ja-JP-Neural2-B';
    let k = null;
    try{ k = await ttscKey(voice, text); const hit = await ttscGet(k); if(hit) return hit; }catch(_){}
    const data = await _ttscOrig.apply(this, arguments);
    if(k && data) ttscPut(k, data).catch(e => console.warn('tts cache', e));
    return data;
  };
}
// 設定パネル（読み上げ）に「保存した音声」を出す
function ttscFmt(n){ return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB'; }
async function ttscPanelRefresh(){
  const el = document.getElementById('ttsc-size'); if(!el) return;
  const n = await ttscSize();
  el.textContent = n ? ttscFmt(Math.round(n * 0.75)) : 'なし';
}
function ttscPanelSetup(){
  if(document.getElementById('ttsc-row')) return;
  const eng = document.getElementById('tts-engine-btns'); if(!eng) return;
  const sec = eng.closest('.ps'); if(!sec) return;
  const row = document.createElement('div');
  row.className = 'ps'; row.id = 'ttsc-row'; row.dataset.uxT = 'tts';
  row.innerHTML = `<div class="pl">保存した音声<small>Googleの高音質で聞いた音声。同じ文をもう一度聞くときは、ここから再生するのでお金がかかりません（300MBまで・古いものから自動で消えます）</small></div>
    <div class="ttsc-line"><span id="ttsc-size">…</span><button class="ttsc-clear" onclick="ttscClear()">消す</button></div>`;
  sec.after(row);
}
if(typeof togglePanel === 'function'){
  const _ttscOrigTP = togglePanel;
  togglePanel = function(){ const r = _ttscOrigTP.apply(this, arguments); try{ ttscPanelSetup(); ttscPanelRefresh(); }catch(_){} return r; };
}
/* ══════ 読み上げ音声の保存ここまで ══════ */
