const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.dismiss());
await pg.route(/workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({works:[],rankAvailable:true})}));
const F=process.argv[2]||'index.html';
await pg.goto('http://localhost:8765/'+F);await pg.waitForTimeout(2500);
const S=async n=>{await pg.waitForTimeout(700);await pg.screenshot({path:`/tmp/claude-0/ui/u_${n}.png`});};
const o={};
await pg.evaluate(async()=>{const p=azParse(await azFetch('628.txt','text'));await azAddNovel(p,{id:'az628'});const n=makeNovel('わたしの小説');n.author='いかすみ';n.episodes=[1,2,3].map(i=>{const e=makeEpisode(i,'第'+i+'話 はじまり',[{paras:[{type:'text',text:'これはテストの本文です。'.repeat(30),align:'left',size:16,color:'#1a1208'},{type:'text',text:'「セリフです」',align:'left',size:16,color:'#1a1208'}]}]);e.charCount=400;return e;});await libDbPut(n);state.library.push(n);window._nid=n.id;});
// own book: toc
await pg.evaluate(()=>openNovel(window._nid));await S('toc_own');
o.tocBtns=await pg.evaluate(()=>document.getElementById('ux-toc-acts').innerText);
await pg.evaluate(()=>openEpisode(state.novel.episodes.find(e=>e.number===1).id));await S('read');
o.title=await pg.evaluate(()=>document.getElementById('topbar-title').getAttribute('data-book')+' | '+document.getElementById('topbar-title').textContent);
// center tap -> immersive
await pg.mouse.click(195,420);await pg.waitForTimeout(600);o.imm1=await pg.evaluate(()=>document.body.classList.contains('ux-immersive'));await S('immersive');
await pg.mouse.click(195,420);await pg.waitForTimeout(600);o.imm2=await pg.evaluate(()=>document.body.classList.contains('ux-immersive'));
// edge tap shouldn't toggle
await pg.mouse.click(20,420);await pg.waitForTimeout(600);o.immEdge=await pg.evaluate(()=>document.body.classList.contains('ux-immersive'));
// end card
await pg.evaluate(()=>{const p=document.querySelector('.page.cur');p.scrollTop=p.scrollHeight;});await S('end');
o.end=await pg.evaluate(()=>!!document.querySelector('.ux-end'));
// edit mode safety
const before=await pg.evaluate(()=>JSON.stringify(state.pages));
await pg.evaluate(()=>{enterEditMode();});await pg.waitForTimeout(500);
o.endHiddenInEdit=await pg.evaluate(()=>{const e=document.querySelector('.page.cur .ux-end');return e?getComputedStyle(e).display:'none';});
await pg.evaluate(()=>{syncEditorToState(state.curPage);exitEditMode();});await pg.waitForTimeout(500);
const after=await pg.evaluate(()=>JSON.stringify(state.pages));
o.editSafe=before===after; o.editSafe2={same:JSON.parse(before)[0].paras.map(p=>p.text).join()===JSON.parse(after)[0].paras.map(p=>p.text).join(), n:[JSON.parse(before)[0].paras.length,JSON.parse(after)[0].paras.length], leak:/次の話|ここまで|目次に戻る/.test(after)};
if(!o.editSafe){o.diff=[before.length,after.length,after.slice(-300)];}
// next ep
await pg.evaluate(()=>openEpisode(state.novel.episodes.find(e=>e.number===2).id));await pg.waitForTimeout(800);
o.afterNext=await pg.evaluate(()=>state.novel.episodes.find(e=>e.id===state.currentEpisodeId).number);
// panel
await pg.evaluate(()=>togglePanel());await S('panel_text');
o.tabs=await pg.evaluate(()=>[...document.querySelectorAll('#panel-body > [data-ux-t]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>((e.querySelector('.pl')||e.querySelector('summary')||{}).textContent||e.id||'?').trim().slice(0,12)));
await pg.evaluate(()=>uxPanelTab('tts'));await S('panel_tts');
await pg.evaluate(()=>uxPanelTab('etc'));await S('panel_etc');
await pg.evaluate(()=>closePanel());
// edit mode panel shows all
await pg.evaluate(()=>{enterEditMode();togglePanel();});await pg.waitForTimeout(400);
o.allInEdit=await pg.evaluate(()=>document.getElementById('panel-body').classList.contains('ux-all'));
await pg.evaluate(()=>{closePanel();exitEditMode();});
// library
await pg.evaluate(()=>showLibrary());await S('lib');
o.cont=await pg.evaluate(()=>{const c=document.getElementById('ux-continue');return c?c.innerText.replace(/\n/g,' / '):null;});
await pg.evaluate(()=>openBackupMenu());await S('libmenu');
await pg.evaluate(()=>closeBackupMenu());
await pg.evaluate(()=>uxContinue(window._nid));await pg.waitForTimeout(1200);o.contOpened=await pg.evaluate(()=>state.currentEpisodeId&&state.novel.episodes.find(e=>e.id===state.currentEpisodeId).number);
// aozora toc (read-only: no fab)
await pg.evaluate(()=>{showLibrary();const n=state.library.find(x=>x.ext);return openNovel(n.id);});await S('toc_az');
o.fabRO=await pg.evaluate(()=>getComputedStyle(document.getElementById('toc-fab')).display);
await pg.evaluate(()=>toggleExportMenu());await S('exportmenu');
console.log(JSON.stringify(o,null,1));console.log('errs',errs);await b.close();})();
