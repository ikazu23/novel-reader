const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800}});
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(1800);
const o=await pg.evaluate(async()=>{const r={};const posts=[];
  window.addEventListener('message',e=>{if(typeof e.data==='string'&&e.data.startsWith('kztlNovel:')){const d=JSON.parse(e.data.slice(10));if(d.type!=='send')posts.push(d);}});
  const wait=ms=>new Promise(x=>setTimeout(x,ms));
  // 本と、ムンピアくんの作品をつなぐ
  const n=makeNovel('全知（原文）');n.id='nv_orv';n.episodes=[];await libDbPut(n);state.library.push(n);
  const m=kzLinkMap();m['munpia|1']='nv_orv';kzSaveLinkMap(m);
  const ep=(i,t,sig)=>({key:'munpia|/v/1/'+i,wk:'munpia|1',work:'全知（原文）',title:t,num:i,n:3,h:'H'+i+sig,sig,data:{paras:[{text:t+'の本文',html:t+'の本文'}]}});
  const send=eps=>window.postMessage('kztlNovel:'+JSON.stringify({type:'send',eps}),location.origin);
  send([ep(1,'1화','S1'),ep(2,'웹소설의 유토피아, 글세상 문피아','S2')]);await wait(800);
  const titles=()=>state.library.find(x=>x.id==='nv_orv').episodes.map(e=>e.number+':'+e.title).sort().join(' | ');
  r.imported=titles();
  // 目次で2話を消す（確認のOK）
  await openNovel('nv_orv');const e2=state.novel.episodes.find(e=>e.number===2);deleteEpisode(e2.id);
  // すぐスクリプトが送り直す（iPhoneでOKを押したあと）
  send([ep(2,'웹소설의 유토피아, 글세상 문피아','S2')]);await wait(1200);
  r.afterResend=state.novel.episodes.map(e=>e.number).join(',');
  r.ackForDeleted=posts.some(p=>p.type==='ack'&&p.items.some(a=>a.key==='munpia|/v/1/2'));
  r.haveHasDeleted=JSON.stringify(kzHave().have['munpia|/v/1/2']);
  // 開き直しても戻らない
  showToc();showLibrary();await wait(300);r.kzDel=Object.keys(state.library.find(x=>x.id==='nv_orv').kzDel||{});
  // もとに戻す → 次に届いたら入る
  kzOpenSkipList();await wait(300);r.listText=document.querySelector('#az-sheet')?document.querySelector('#az-sheet').innerText.replace(/\n/g,' / ').slice(0,200):null;
  kzDelRestore('nv_orv','munpia|/v/1/2');await wait(300);send([ep(2,'웹소설의 유토피아, 글세상 문피아','S2')]);await wait(1200);r.afterRestore=titles();
  return r;});
await pg.screenshot({path:'/tmp/claude-0/kzdel_list.png'});
// 同期の途中で話を消す
const o2=await pg.evaluate(async()=>{const wait=ms=>new Promise(x=>setTimeout(x,ms));azClose&&azClose();
  await openNovel('nv_orv');const stale=JSON.parse(JSON.stringify(state.novel));stale.updatedAt=new Date(Date.now()+60000).toISOString();
  const e1=state.novel.episodes.find(e=>e.number===1);
  deleteEpisode(e1.id); // 800ms の保存を待たずに
  const ed=state.novel.episodes[0];ed.title='直した題名';
  const res=await gdMergeLibrary({library:[stale]});
  await wait(1000);
  return {eps:state.novel.episodes.map(e=>e.number+':'+e.title).join(' | '),lib:state.library.find(x=>x.id==='nv_orv').episodes.map(e=>e.number).join(','),libIsCopy:state.library.find(x=>x.id==='nv_orv')!==state.novel};});
console.log(JSON.stringify(o,null,1),JSON.stringify(o2),errs);await b.close();})();
