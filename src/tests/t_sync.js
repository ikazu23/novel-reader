const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();let uploads=0,imgs=0;
await ctx.route(/googleapis\.com\/upload\/drive/,async r=>{const u=r.request().url();if(/fields=id/.test(u)){imgs++;await new Promise(x=>setTimeout(x,4000));return r.fulfill({status:200,contentType:'application/json',body:'{"id":"img1"}'});}uploads++;await new Promise(x=>setTimeout(x,2500));r.fulfill({status:200,contentType:'application/json',body:'{}'});});
await ctx.route(/googleapis\.com\/drive\/v3\/files\?/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"files":[]}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));const toasts=[];
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(2000);
await pg.exposeFunction('_t',t=>toasts.push(t));
await pg.evaluate(()=>{const o=showToast;showToast=function(t){window._t(t);return o.apply(this,arguments);};
  gdriveIsSignedIn=()=>true;gdriveEnsureToken=async()=>{};gdriveFindFile=async()=>({id:'f1'});window._gdriveAccessToken='x';
  // 挿絵が1枚ある
  imgDbGet=async()=>'data:image/png;base64,AAAA';collectLibraryImageNames=()=>new Set(['a.png']);localStorage.removeItem(LS_UPLOADED_IMAGES);localStorage.removeItem(LS_LAST_SYNC);});
const t0=Date.now();
await pg.evaluate(()=>{gdriveUploadData().catch(()=>{});});   // 自動同期が走っている
await pg.waitForTimeout(300);
const r=await pg.evaluate(async()=>{const s=Date.now();await gdriveSyncNow();return {ms:Date.now()-s,last:localStorage.getItem(LS_LAST_SYNC),err:localStorage.getItem(LS_LAST_ERR)};});
console.log({uploads,imgs,manual:r,toasts});
// 失敗のとき
await ctx.unroute(/googleapis\.com\/upload\/drive/);await ctx.route(/googleapis\.com\/upload\/drive/,r=>r.fulfill({status:413,body:'too big'}));
const r2=await pg.evaluate(async()=>{await gdriveSyncNow();return localStorage.getItem(LS_LAST_ERR);});
console.log('fail:',r2,toasts.slice(-1),errs);await b.close();})();
