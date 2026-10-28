const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:844}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(2000);
const o={};
o.setup=await pg.evaluate(async()=>{const n=makeNovel('怪談出勤');n.episodes=[makeEpisode(1,'1話',[{paras:[{type:'text',text:'本文',align:'left',size:15,color:'#222'}]}])];n.episodes[0].charCount=2;await libDbPut(n);state.library.push(n);const m=kzLinkMap();m['wk-kaidan']=n.id;kzSaveLinkMap(m);window._nid=n.id;
  window._posts=[];const op=kzLinkPost;kzLinkPost=x=>{window._posts.push(x);};let called=0;window._askCount=()=>called;const oa=kzAskTargets;kzAskTargets=function(){called++;return oa.apply(this,arguments);};
  let syncs=0;scheduleGdriveAutoSync=()=>{syncs++;};window._syncs=()=>syncs;return 'ok';});
await pg.evaluate(()=>deleteNovel(window._nid));await pg.waitForTimeout(400);
o.map=await pg.evaluate(()=>kzLinkMap()['wk-kaidan']);o.syncs=await pg.evaluate(()=>window._syncs());
// 訳が届く
await pg.evaluate(()=>{kzLinkReadyFlag=true;kzReceive([{key:'k1',wk:'wk-kaidan',work:'怪談出勤',n:1,title:'1話',data:{paras:[{text:'訳'}]}}]);});await pg.waitForTimeout(800);
o.asked=await pg.evaluate(()=>window._askCount());o.revived=await pg.evaluate(()=>state.library.some(n=>n.title==='怪談出勤'));o.acked=await pg.evaluate(()=>window._posts.some(p=>p.type==='ack'));
// メニューに出る
await pg.evaluate(()=>openBackupMenu());await pg.waitForTimeout(300);o.menu=await pg.evaluate(()=>(document.getElementById('ux-kz-skip')||{}).textContent);
await pg.evaluate(()=>{closeBackupMenu();kzOpenSkipList();});await pg.waitForTimeout(400);await pg.screenshot({path:'/tmp/claude-0/skip.png'});
await pg.evaluate(()=>kzUnskip('wk-kaidan'));o.afterUnskip=await pg.evaluate(()=>kzLinkMap()['wk-kaidan']||null);
await pg.evaluate(()=>{azClose();kzReceive([{key:'k1',wk:'wk-kaidan',work:'怪談出勤',n:1,title:'1話',data:{paras:[{text:'訳'}]}}]);});await pg.waitForTimeout(800);
o.askedAfter=await pg.evaluate(()=>window._askCount());
console.log(o,errs);await b.close();})();
