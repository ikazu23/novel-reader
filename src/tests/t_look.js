const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800},deviceScaleFactor:2});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/'+(process.argv[2]||'beta2/index.html'));await pg.waitForTimeout(2500);
const r=await pg.evaluate(async()=>{applyParaSpacing(0);applyParaLineHeight(1.6);
 const p=azParse(await azFetch('127.txt','text'));const n=await azAddNovel(p,{id:'az127'});
 // old-style book without look (simulate already added before update)
 const p2=azParse(await azFetch('92.txt','text'));const n2=await azAddNovel(p2,{id:'az92'}); delete n2.lineHeight; delete n2.paraSpacing; delete n2.ext.look;
 renderLibrary(); await new Promise(r=>setTimeout(r,300));
 await openNovel(n.id); openEpisode(n.episodes[0].id); await new Promise(r=>setTimeout(r,1000));
 const cs=getComputedStyle(document.documentElement);
 return {lh:cs.getPropertyValue('--para-line-height'),ps:cs.getPropertyValue('--para-spacing'),cls:document.body.classList.contains('az-book'),n2:[n2.lineHeight,n2.paraSpacing,n2.ext.look],global:[state.settings.lineHeight,state.settings.paraSpacing]};});
console.log(r);
await pg.screenshot({path:'/tmp/claude-0/look_az.png'});
const r2=await pg.evaluate(async()=>{showLibrary();await new Promise(r=>setTimeout(r,300));if(!state.library.some(n=>!n.ext)){const nn=makeNovel('ふつう');nn.episodes=[makeEpisode(1,'1',getDefaultPages())];await libDbPut(nn);state.library.push(nn);}const other=state.library.find(n=>!n.ext);await openNovel(other.id);await new Promise(r=>setTimeout(r,300));const cs=getComputedStyle(document.documentElement);return {lh:cs.getPropertyValue('--para-line-height'),ps:cs.getPropertyValue('--para-spacing'),cls:document.body.classList.contains('az-book')};});
console.log('other book',r2,errs);await b.close();})();
