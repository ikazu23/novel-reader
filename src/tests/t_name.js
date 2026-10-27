const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(2000);
await pg.evaluate(async()=>{const K=['천혜성과 눈이 마주친 내가 반사적으로 고개를 끄덕였다.','하늘이 맑았다.','그는 천천히 걸어갔다.'];const n=makeNovel('名前テスト');n.episodes=[makeEpisode(1,'1화',[{paras:K.map(t=>({type:'text',text:t,align:'left',size:17,color:'#222'}))}])];n.episodes[0].charCount=50;n.koMode='on';await libDbPut(n);state.library.push(n);await openNovel(n.id);openEpisode(n.episodes[0].id);await koDictLoad();});
await pg.waitForTimeout(1500);
const out={};
for(const [w,qi] of [['천혜성과',0],['하늘이',1],['걸어갔다',2]]){
  const pos=await pg.evaluate(([w,qi])=>{const p=document.querySelector(`.page.cur p[data-qi="${qi}"]`);const tw=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;while((n=tw.nextNode())){const i=n.textContent.indexOf(w);if(i>=0){const r=document.createRange();r.setStart(n,i+1);r.setEnd(n,i+2);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};}}return null;},[w,qi]);
  await pg.touchscreen.tap(pos.x,pos.y);await pg.waitForTimeout(1800);
  out[w]=await pg.evaluate(()=>({btn:(document.querySelector('#ko-sheet .ko-name-btn')||{}).textContent||null,link:(document.querySelector('#ko-sheet .ko-name-link')||{}).textContent||null}));
  if(w==='천혜성과'){await pg.screenshot({path:'/tmp/claude-0/name1.png'});await pg.evaluate(()=>{const b=document.querySelector('#ko-sheet .ko-name-btn, #ko-sheet .ko-name-link');b&&b.click();});await pg.waitForTimeout(500);out.after=await pg.evaluate(()=>({top:(document.querySelector('#ko-sheet .ko-form-info')||{}).innerText,ms:_koEdit.ms.map(x=>x.m),memo:document.getElementById('ko-memo').value,key:document.getElementById('ko-key').value}));}
  if(w==='하늘이')await pg.screenshot({path:'/tmp/claude-0/name2.png'});
  await pg.evaluate(()=>koCloseSheet());await pg.waitForTimeout(400);
}
console.log(JSON.stringify(out,null,1),errs);await b.close();})();
