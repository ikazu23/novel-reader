const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
const toasts=[];await pg.exposeFunction('_t',t=>toasts.push(t));
const url='http://localhost:8765/'+(process.argv[2]||'index.html');
const boot=async()=>{await pg.goto(url);await pg.waitForTimeout(1800);await pg.evaluate(()=>{const o=showToast;showToast=function(t){window._t(t);return o.apply(this,arguments);};});};
await boot();const o={};
// 本を4冊作る
await pg.evaluate(async()=>{for(const t of ['A','B','C','D']){const n=makeNovel(t);n.id='nv_'+t;n.episodes=[makeEpisode(1,'1',getDefaultPages())];await libDbPut(n);state.library.push(n);}renderLibrary();});
// 1) つながり切れ（Safariの不具合と同じ：閉じたつながりで transaction すると InvalidStateError）
o.closedErr=await pg.evaluate(async()=>{_db.close();try{_db.transaction(DB_LIBRARY_STORE,'readonly');return 'no error?';}catch(e){return e.name;}});
await pg.evaluate(async()=>{await deleteNovel('nv_A');});
// 2) 途中で止まる（1回目の書き込みを abort）
await pg.evaluate(async()=>{const P=IDBDatabase.prototype,orig=P.transaction;let n=0;P.transaction=function(){const tx=orig.apply(this,arguments);if(n++===0)setTimeout(()=>{try{tx.abort();}catch(_){}},0);return tx;};await deleteNovel('nv_B');P.transaction=orig;});
// 3) 何度やっても消せない → 知らせる → 次に開いたときに消える
await pg.evaluate(async()=>{const P=IDBObjectStore.prototype,orig=P.delete;P.delete=function(){throw new DOMException('lost','UnknownError');};await deleteNovel('nv_C');P.delete=orig;});
o.toastFail=toasts.filter(t=>/うまく消せません/.test(t));
o.beforeReloadDB=await pg.evaluate(async()=>(await new Promise(r=>{const q=indexedDB.open(DB_NAME);q.onsuccess=()=>{const g=q.result.transaction(DB_LIBRARY_STORE).objectStore(DB_LIBRARY_STORE).getAllKeys();g.onsuccess=()=>{r(g.result);q.result.close();};};})).filter(k=>/^nv_/.test(k)).sort());
o.tomb=await pg.evaluate(()=>Object.keys(gdDelMap()).sort());
// 4) つながりが切れたあとの保存
await pg.evaluate(async()=>{await openNovel('nv_D');state.novel.title='D2';_db.close();save();await new Promise(r=>setTimeout(r,800));showLibrary();});
await boot();
o.afterReload=await pg.evaluate(()=>state.library.map(n=>n.title).sort().join(','));
o.dbAfter=await pg.evaluate(async()=>(await libDbGetAll()).map(n=>n.id).filter(k=>/^nv_/.test(k)).sort());
// 5) 消した記録のある本を開いている間に同期 → 開いている間は残る、閉じて同期したら消える
o.openCase=await pg.evaluate(async()=>{const n=makeNovel('E');n.id='nv_E';n.episodes=[makeEpisode(1,'1',getDefaultPages())];await libDbPut(n);state.library.push(n);
  await openNovel('nv_E');const r1=await gdMergeLibrary({library:[],deleted:{nv_E:new Date(Date.now()+1000).toISOString()}});const kept=state.library.some(x=>x.id==='nv_E');
  save();await new Promise(r=>setTimeout(r,300));showLibrary();await gdMergeLibrary({library:[]});const gone=!state.library.some(x=>x.id==='nv_E');
  return {kept,gone,tomb:!!gdDelMap().nv_E};});
console.log(JSON.stringify(o,null,1),errs);await b.close();})();
