const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(1800);
const o=await pg.evaluate(async()=>{
  workApi=async()=>({status:'public',title:'共有W',author:'x'});loadWorkIndex=async()=>({title:'共有W',episodes:[]});
  downloadWorkEpisodes=async()=>[makeEpisode(1,'1',getDefaultPages())];fetchCoverDataUrl=async()=>'';checkSharedUpdates=()=>{};
  await addWorkToLibrary('w1');const r={added:state.library.some(n=>n.id==='shared_w1')};
  removeCurrentFromLibrary();await new Promise(r=>setTimeout(r,500));
  r.tombAfterRemove=!!gdDelMap().shared_w1;r.goneAfterRemove=!state.library.some(n=>n.id==='shared_w1');
  await addWorkToLibrary('w1');r.readded=state.library.some(n=>n.id==='shared_w1');r.tombAfterReadd=!!gdDelMap().shared_w1;
  showLibrary();
  // ほかの端末の古い「消した記録」が届いても、追加し直した本は残る
  await gdMergeLibrary({library:[],deleted:{shared_w1:new Date(Date.now()-5000).toISOString()}});
  r.survivesOldTomb=state.library.some(n=>n.id==='shared_w1');return r;});
console.log(o,errs);await b.close();})();
