const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>{errs.push('dialog:'+d.message().slice(0,40));d.dismiss();});
const F=process.argv[2]||'beta2/index.html';
await pg.goto('http://localhost:8765/'+F);await pg.waitForTimeout(2500);
await pg.screenshot({path:'/tmp/claude-0/az1_lib.png'});
await pg.click('#library-fab');await pg.waitForTimeout(400);await pg.screenshot({path:'/tmp/claude-0/az2_add.png'});
await pg.evaluate(()=>azOpenCatalog());await pg.waitForTimeout(800);await pg.screenshot({path:'/tmp/claude-0/az3_cat.png'});
await pg.click('#az-w-0');await pg.waitForTimeout(1500);
const o=await pg.evaluate(()=>{const n=state.library.find(x=>x.ext&&x.ext.id==='az127');return {added:!!n,eps:n&&n.episodes.length,author:n&&n.author,btn:document.getElementById('az-w-0').textContent};});
console.log(o);
await pg.click('#az-w-0');await pg.waitForTimeout(1500);
// open episode 1
await pg.evaluate(()=>{const n=state.novel;openEpisode(n.episodes[0].id);});await pg.waitForTimeout(1200);
await pg.screenshot({path:'/tmp/claude-0/az4_read.png'});
const o2=await pg.evaluate(()=>({ruby:document.querySelectorAll('.page.cur ruby').length,title:state.novel.title}));console.log(o2);
// last page credit
await pg.evaluate(()=>{goToPage(state.pages.length-1)});await pg.waitForTimeout(800);
await pg.evaluate(()=>{const p=document.querySelector('.page.cur');p.scrollTop=p.scrollHeight;});await pg.waitForTimeout(300);
await pg.screenshot({path:'/tmp/claude-0/az5_credit.png'});
// publish guard
const pub=await pg.evaluate(()=>{if(typeof openPublishModal!=='function')return 'none';openPublishModal();return 'called';});console.log('pub',pub);
// file imports
await pg.evaluate(()=>showLibrary());await pg.waitForTimeout(600);
const inpH=await pg.evaluate(()=>{azPickFile=azPickFile;const i=document.createElement('input');return 1});
await pg.evaluate(()=>{let inp=document.getElementById('az-file-input');if(!inp){inp=document.createElement('input');inp.type='file';inp.id='az-file-input';inp.multiple=true;inp.style.display='none';inp.onchange=()=>azImportFiles(inp);document.body.appendChild(inp);}});
await pg.setInputFiles('#az-file-input',['/tmp/claude-0/azfiles/kumo_sjis.txt','/tmp/claude-0/azfiles/plain.txt']);await pg.waitForTimeout(1500);
const o3=await pg.evaluate(()=>state.library.filter(n=>n.ext).map(n=>[n.title,n.author,n.ext.kind,n.episodes.length,n.episodes[0].pages[0].paras.slice(0,3).map(p=>p.html).join(' / ').slice(0,120)]));console.log(JSON.stringify(o3,null,1));
await pg.evaluate(()=>showLibrary());await pg.waitForTimeout(800);await pg.screenshot({path:'/tmp/claude-0/az6_lib2.png'});
console.log('errs',errs);await b.close();})();
