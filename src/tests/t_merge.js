// 2台の端末で同じクラウド（偽のGoogleドライブ）を使う
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
const cloud={content:null,mt:null,files:{},dl:0};
const setup=async(ctx)=>{
  await ctx.route(/googleapis\.com/,async r=>{const u=new URL(r.request().url());const m=r.request().method();
    if(u.pathname==='/drive/v3/files'&&m==='GET'){const q=u.searchParams.get('q')||'';const nm=(q.match(/name='([^']+)'/)||[])[1];
      if(nm&&nm.startsWith('novel-reader-data'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({files:cloud.content?[{id:'f1',name:nm,modifiedTime:cloud.mt}]:[]})});
      return r.fulfill({status:200,contentType:'application/json',body:'{"files":[]}'});}
    if(u.pathname==='/drive/v3/files/f1'&&u.searchParams.get('alt')==='media'){cloud.dl++;}if(u.pathname==='/drive/v3/files/f1'&&u.searchParams.get('alt')==='media')return r.fulfill({status:200,contentType:'application/json',body:cloud.content||'{}'});
    if(u.pathname.startsWith('/upload/drive/v3/files')){const body=r.request().postData()||'';
      if(/novel-reader-data[-a-z0-9]*\.json/.test(body)||/\/files\/f1/.test(u.pathname)){const parts=body.split(/\r\n--[^\r\n]+/);const js=parts[1]||'';const i=js.indexOf('\r\n\r\n');const c=js.slice(i+4);if(c.trim().startsWith('{')&&c.includes('"library"')){cloud.content=c;cloud.mt=new Date(Date.now()+(++cloud.n||1)).toISOString();cloud.n=(cloud.n||0)+1;}}
      return r.fulfill({status:200,contentType:'application/json',body:'{"id":"f1"}'});}
    return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.on('dialog',d=>d.accept());
  await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(1800);
  pg.mock=()=>pg.evaluate(()=>{gdriveIsSignedIn=()=>true;gdriveEnsureToken=async()=>{};koSyncWords=async()=>{};collectLibraryImageNames=()=>new Set();scheduleGdriveAutoSync=()=>{};
    window._lib=()=>state.library.map(n=>n.title+'['+n.episodes.map(e=>e.title).join(',')+']').sort().join(' | ');});
  await pg.mock();return pg;};
const A=await setup(await b.newContext()), B=await setup(await b.newContext());
const L=async(p)=>p.evaluate(()=>window._lib());
// A：本X・Yを作って同期
await A.evaluate(async()=>{for(const n of state.library.slice())state.library=state.library.filter(x=>x!==n);
  const mk=(t,eps)=>{const n=makeNovel(t);n.episodes=eps.map((e,i)=>{const ep=makeEpisode(i+1,e,[{paras:[{type:'text',text:e+'の本文',align:'left',size:15,color:'#222'}]}]);ep.id='ep_'+t+'_'+i;ep.charCount=5;return ep;});n.id='nv_'+t;return n;};
  const X=mk('X',['X1']),Y=mk('Y',['Y1']);for(const n of [X,Y]){await libDbPut(n);state.library.push(n);} await gdriveUploadData();});
// B：復元
await B.evaluate(async()=>{gdriveRestoreFromCloud();});await B.waitForTimeout(1500);
const o={B0:await L(B)};
// A：Xを消して同期
await A.evaluate(async()=>{await deleteNovel('nv_X');await gdriveUploadData();});o.A1=await L(A);
// B：Xのことは知らないまま、Yを読んで（updatedAtが進む）同期
await B.evaluate(async()=>{await openNovel('nv_Y');openEpisode('ep_Y_0');await new Promise(r=>setTimeout(r,300));showToc();await gdriveUploadData();});o.B1=await L(B);
// A：復元 → Xは戻らない？
await A.evaluate(async()=>{gdriveRestoreFromCloud();});await A.waitForTimeout(1500);o.A2=await L(A);
// A：Yに2話を足して同期。B：古いままYを読んで同期 → 2話は消えない？
await A.evaluate(async()=>{await openNovel('nv_Y');state.novel.episodes.push(Object.assign(makeEpisode(2,'Y2',[{paras:[{type:'text',text:'2話',align:'left',size:15,color:'#222'}]}]),{id:'ep_Y_1',charCount:2}));save();await new Promise(r=>setTimeout(r,200));showLibrary();await gdriveUploadData();});
await B.evaluate(async()=>{showLibrary();await openNovel('nv_Y');openEpisode('ep_Y_0');await new Promise(r=>setTimeout(r,300));showToc();showLibrary();await gdriveUploadData();});o.B2=await L(B);
await A.evaluate(async()=>{gdriveRestoreFromCloud();});await A.waitForTimeout(1500);o.A3=await L(A);
// B：Y1を書き直して同期 → Aで直したものが届く？
await B.evaluate(async()=>{await openNovel('nv_Y');openEpisode('ep_Y_0');state.pages=[{paras:[{type:'text',text:'B が直した本文',html:'B が直した本文',align:'left',size:15,color:'#222'}]}];save();showToc();showLibrary();await gdriveUploadData();});
await A.evaluate(async()=>{gdriveRestoreFromCloud();});await A.waitForTimeout(1500);
o.A4=await A.evaluate(()=>state.library.find(n=>n.id==='nv_Y').episodes.find(e=>e.id==='ep_Y_0').pages[0].paras[0].text);
// A：Y2を消して同期 → Bでも消える？
await A.evaluate(async()=>{await openNovel('nv_Y');deleteEpisode('ep_Y_1');await new Promise(r=>setTimeout(r,1200));showLibrary();await gdriveUploadData();});
await B.evaluate(async()=>{gdriveRestoreFromCloud();});await B.waitForTimeout(1500);o.B3=await L(B);
// IndexedDB にも反映されている？（開き直し）
await B.reload();await B.waitForTimeout(1800);o.B3reload=await B.evaluate(()=>state.library.map(n=>n.title+'['+n.episodes.map(e=>e.title).join(',')+']').sort().join(' | '));await B.mock();

// --- 追加ケース ---
// C1: A が本Z作成→同期。B 取り込み。A がZを消して同期。B はZを開いて読む（updatedAt進む）→同期 → Zは消える（復活しない）
await A.evaluate(async()=>{const n=makeNovel('Z');n.id='nv_Z';const ep=makeEpisode(1,'Z1',[{paras:[{type:'text',text:'z',align:'left',size:15,color:'#222'}]}]);ep.id='ep_Z_0';n.episodes=[ep];await libDbPut(n);state.library.push(n);showLibrary();await gdriveUploadData();});
await B.evaluate(async()=>{showLibrary();await gdriveUploadData();});o.C1a=await L(B);
await A.evaluate(async()=>{await deleteNovel('nv_Z');await gdriveUploadData();});
await B.evaluate(async()=>{await openNovel('nv_Z');openEpisode('ep_Z_0');await new Promise(r=>setTimeout(r,300));save();await new Promise(r=>setTimeout(r,300));showToc();showLibrary();await gdriveUploadData();});o.C1b=await L(B);
await A.evaluate(async()=>{showLibrary();await gdriveUploadData();});o.C1c=await L(A);
// C2: A がバックアップからZを戻す → 同期 → B にも戻る
o.C2bk=await A.evaluate(async()=>{const d=await backupGetAll('nv_Z');return d&&d.generations?d.generations.length:0;});
if(o.C2bk){await A.evaluate(async()=>{closeBackupModal=()=>{};closePanel=()=>{};await restoreFromBackup('nv_Z',0);await gdriveUploadData();});o.C2a=await L(A);
await B.evaluate(async()=>{showLibrary();await gdriveUploadData();});o.C2b=await L(B);}
// C3: 変化がないときはダウンロードしない
await B.evaluate(async()=>{await gdriveUploadData();});const d0=cloud.dl;await B.evaluate(async()=>{await gdriveUploadData();});o.C3_noDownload=(cloud.dl===d0);
// C4: 古いアプリのデータ（deleted なし）でも動く
console.log(JSON.stringify(o),A.errs,B.errs,cloud.content&&cloud.content.length);const old=JSON.parse(cloud.content);delete old.deleted;old.library.push({id:'nv_OLD',title:'OLD',author:'',episodes:[],updatedAt:new Date().toISOString()});cloud.content=JSON.stringify(old);cloud.mt=new Date(Date.now()+99999).toISOString();
await B.evaluate(async()=>{showLibrary();await gdriveUploadData();});o.C4=await L(B);
// C5: B が本Yの話を開いて読んでいる最中に、A の変更（3話追加）が届く → 開いている話はそのまま、3話は入る
await A.evaluate(async()=>{showLibrary();await gdriveUploadData();await openNovel('nv_Y');state.novel.episodes.push(Object.assign(makeEpisode(3,'Y3',[{paras:[{type:'text',text:'3話',align:'left',size:15,color:'#222'}]}]),{id:'ep_Y_2',charCount:2}));save();await new Promise(r=>setTimeout(r,200));showLibrary();await gdriveUploadData();});
o.C5=await B.evaluate(async()=>{await openNovel('nv_Y');openEpisode('ep_Y_0');await new Promise(r=>setTimeout(r,300));await gdriveUploadData();return {open:state.currentEpisodeId,eps:state.novel.episodes.map(e=>e.title).join(','),lib:state.library.find(n=>n.id==='nv_Y').episodes.map(e=>e.title).join(','),reader:!!document.querySelector('#reader-screen.show,#reader.show,.reader.show')||state.currentEpisodeId==='ep_Y_0'};});

await A.evaluate(async()=>{showLibrary();const n=makeNovel('W');n.id='nv_W';const ep=makeEpisode(1,'W1',[{paras:[{type:'text',text:'w',align:'left',size:15,color:'#222'}]}]);ep.id='ep_W_0';n.episodes=[ep];await libDbPut(n);state.library.push(n);await autoBackup(n,true,true);await gdriveUploadData();});
await B.evaluate(async()=>{showLibrary();await gdriveUploadData();});o.W1=await L(B);
await A.evaluate(async()=>{await deleteNovel('nv_W');await gdriveUploadData();});
await B.evaluate(async()=>{await gdriveUploadData();});o.W2=await L(B);
o.Wbk=await A.evaluate(async()=>{const d=await backupGetAll('nv_W');return d&&d.generations?d.generations.length:0;});
await A.evaluate(async()=>{closeBackupModal=()=>{};closePanel=()=>{};await restoreFromBackup('nv_W',0);await gdriveUploadData();});o.W3a=await L(A);
await B.evaluate(async()=>{await gdriveUploadData();});o.W3b=await L(B);
await A.evaluate(async()=>{await gdriveUploadData();});o.W4a=await L(A);
console.log(JSON.stringify(o,null,1),A.errs,B.errs);await b.close();})();
