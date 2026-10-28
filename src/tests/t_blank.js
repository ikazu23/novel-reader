const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800}});
let up=null;
await ctx.route(/googleapis\.com/,async r=>{const u=new URL(r.request().url());
 if(u.pathname==='/drive/v3/files'&&r.request().method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({files:/novel-reader-data/.test(u.searchParams.get('q')||'')?[{id:'f1',modifiedTime:'t'+Date.now()}]:[]})});
 if(u.searchParams.get('alt')==='media')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({library:[{id:'nv_rblank',title:'無題の小説',author:'',cover:'',episodes:[{id:'e',number:1,title:'第1話',pages:[{paras:[{type:'text',text:'',html:'<br>'}]}],charCount:0}],updatedAt:'2026-01-01T00:00:00Z'}]})});
 if(u.pathname.startsWith('/upload/')){up=r.request().postData();return r.fulfill({status:200,contentType:'application/json',body:'{}'});}
 return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
await ctx.route(/workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
const url='http://localhost:8765/'+(process.argv[2]||'index.html');
const boot=async()=>{await pg.goto(url);await pg.waitForTimeout(1800);};
const lib=()=>pg.evaluate(()=>state.library.map(n=>n.title).sort().join(','));
const dbIds=()=>pg.evaluate(async()=>(await libDbGetAll()).map(n=>n.title).sort().join(','));
const o={};
await boot();o.fresh=await lib();o.freshMsg=await pg.evaluate(()=>!!document.querySelector('#library-grid .lib-empty'));
await boot();await boot();o.after3=await dbIds();
await pg.screenshot({path:'/tmp/claude-0/emptylib2.png'});
// 本を作る（新しい本を書く）
await pg.evaluate(async()=>{await createNewNovel();state.novel.title='本1';save();await new Promise(r=>setTimeout(r,300));showLibrary();});
o.made=await lib();o.msgGone=await pg.evaluate(()=>!document.querySelector('#library-grid .lib-empty'));
// 起動直後に本棚が空に見える（1回目の読み込みだけ空を返す）
await pg.addInitScript(()=>{const P=IDBObjectStore.prototype,g=P.getAll;let n=0;P.getAll=function(){window._ga=(window._ga||0)+1;if(this.name==='libraryData'&&n++<1){const rq=g.call(this,'__none__');return rq;}return g.apply(this,arguments);};});
await boot();o.flaky=await lib();o.getAllCalls=await pg.evaluate(()=>window._ga);o.flakyDB=await dbIds();
// 2日前に勝手に作られた空の本と、今作った空の本
await pg.evaluate(async()=>{for(const [id,t] of [['nv_old',new Date(Date.now()-2*864e5).toISOString()],['nv_new',new Date().toISOString()]]){const n=makeNovel('無題の小説');n.id=id;n.updatedAt=t;n.episodes=[makeEpisode(1,'第1話',getDefaultPages())];await libDbPut(n);}});
await boot();o.cleanup=await pg.evaluate(()=>state.library.map(n=>n.id.startsWith('nv_')?n.id:n.title).sort().join(','));
o.cleanupTomb=await pg.evaluate(()=>Object.keys(gdDelMap()).join(','));
// 同期：空の本は送らない・ほかの端末の空の本は入れない
await pg.evaluate(async()=>{gdriveIsSignedIn=()=>true;gdriveEnsureToken=async()=>{};collectLibraryImageNames=()=>new Set();await gdriveUploadData();});
o.upTitles=JSON.parse(up.split(/\r\n--[^\r\n]+/)[1].split('\r\n\r\n').slice(1).join('\r\n\r\n')).library.map(n=>n.id.startsWith('nv_')?n.id:n.title).sort().join(',');
o.afterSync=await pg.evaluate(()=>state.library.map(n=>n.id.startsWith('nv_')?n.id:n.title).sort().join(','));
// 全部消す
await pg.evaluate(async()=>{for(const n of state.library.slice())await deleteNovel(n.id);});
o.allDel=await lib();o.allDelMsg=await pg.evaluate(()=>!!document.querySelector('#library-grid .lib-empty'));o.had=await pg.evaluate(()=>localStorage.getItem(DB_HAD_LS));
await boot();o.allDelReload=await dbIds();
// ＋ → 新しい本を書く は今まで通り
o.plus=await pg.evaluate(async()=>{azOpenAdd();await new Promise(r=>setTimeout(r,400));const btn=[...document.querySelectorAll('.az-row')].find(b=>/新しい本を書く/.test(b.textContent));btn.click();await new Promise(r=>setTimeout(r,600));return !!state.currentNovelId&&state.library.length;});
console.log(JSON.stringify(o,null,1),errs);await b.close();})();
