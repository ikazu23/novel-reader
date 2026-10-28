const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();const log=[];let putBytes=0;
await ctx.route(/googleapis\.com\/upload\/drive\/v3\/files/,async r=>{const u=r.request().url();const m=r.request().method();
  if(/uploadType=multipart/.test(u)){const len=(r.request().postDataBuffer()||Buffer.alloc(0)).length;log.push('multipart '+Math.round(len/1024)+'KB');if(len>5*1024*1024)return r.abort('connectionreset');return r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{}'});}
  if(/uploadType=resumable/.test(u)){log.push('resumable-init '+m);return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Location','location':'https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=resumable&upload_id=abc'},body:''});}
  return r.continue();});
await ctx.route(/upload_id=abc/,async r=>{putBytes=(r.request().postDataBuffer()||Buffer.alloc(0)).length;log.push('put '+r.request().method()+' '+Math.round(putBytes/1024/1024)+'MB');r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{}'});});
await ctx.route(/googleapis\.com\/drive\/v3\/files\?/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"files":[]}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(2000);
await pg.evaluate(()=>{gdriveIsSignedIn=()=>true;gdriveEnsureToken=async()=>{};gdriveFindFile=async()=>({id:'f1',modifiedTime:'m'});localStorage.setItem(GD_SEEN_LS,'m');collectLibraryImageNames=()=>new Set();koSyncWords=async()=>{};});
// 小さい本棚
const r1=await pg.evaluate(async()=>{localStorage.removeItem(LS_LAST_SYNC);await gdriveSyncNow();return [localStorage.getItem(LS_LAST_SYNC)?'synced':'no',localStorage.getItem(LS_LAST_ERR)];});
log.push('--- big');
// 大きい本棚（約12MB）
const r2=await pg.evaluate(async()=>{const n=makeNovel('大きい本');const t='韓国語の本文です。'.repeat(500);n.episodes=Array.from({length:900},(_,i)=>makeEpisode(i+1,'第'+(i+1)+'話',[{paras:[{type:'text',text:t,align:'left',size:15,color:'#222'}]}]));state.library.push(n);localStorage.removeItem(LS_LAST_SYNC);await gdriveSyncNow();return [localStorage.getItem(LS_LAST_SYNC)?'synced':'no',localStorage.getItem(LS_LAST_ERR)];});
console.log({r1,r2,log},errs);await b.close();})();
