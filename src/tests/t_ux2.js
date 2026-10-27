const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800},hasTouch:true,isMobile:true});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/beta2/index.html');await pg.waitForTimeout(2500);
await pg.evaluate(async()=>{const mk=t=>({type:'text',text:t,align:'left',size:18,color:'#222'});const paras=[];for(let i=0;i<40;i++)paras.push(mk('그는 천천히 고개를 들어 하늘을 바라보았다. 바람이 불어와 머리카락이 흩날렸다.'));const n=makeNovel('韓国語の本');n.episodes=[makeEpisode(1,'1화',[{paras}])];n.episodes[0].charCount=999;await libDbPut(n);state.library.push(n);await openNovel(n.id);openEpisode(n.episodes[0].id);});
await pg.waitForTimeout(1200);
// tap on a word near center
const pos=await pg.evaluate(()=>{const ps=[...document.querySelectorAll('.page.cur p[data-qi]')];const p=ps.find(p=>{const r=p.getBoundingClientRect();return r.top>300&&r.top<500;});const r=p.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+10};});
await pg.touchscreen.tap(pos.x,pos.y);await pg.waitForTimeout(900);
const o={sheet:await pg.evaluate(()=>!!document.querySelector('#ko-sheet.show')),imm:await pg.evaluate(()=>document.body.classList.contains('ux-immersive'))};
await pg.evaluate(()=>koCloseSheet());await pg.waitForTimeout(300);
// double tap -> edit mode
await pg.evaluate(()=>{if(state.readingMode)toggleReadingMode();});
await pg.touchscreen.tap(195,640);await pg.waitForTimeout(80);await pg.touchscreen.tap(195,640);await pg.waitForTimeout(900);
o.edit=await pg.evaluate(()=>state.editMode);o.immAfterDbl=await pg.evaluate(()=>document.body.classList.contains('ux-immersive'));
console.log(o,errs);await b.close();})();
