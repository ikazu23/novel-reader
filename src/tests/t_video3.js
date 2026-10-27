const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({works:[],rankAvailable:true})}));
await pg.addInitScript(()=>{try{localStorage.setItem('ux-tip-tap','1');}catch(_){}
  // タップした場所に丸を出す（動画用）
  document.addEventListener('pointerdown',e=>{const d=document.createElement('div');d.style.cssText=`position:fixed;left:${e.clientX-22}px;top:${e.clientY-22}px;width:44px;height:44px;border-radius:50%;background:rgba(0,128,128,.28);border:2px solid rgba(0,128,128,.6);z-index:99999;pointer-events:none;transition:transform .45s,opacity .45s;`;document.documentElement.appendChild(d);requestAnimationFrame(()=>{d.style.transform='scale(1.6)';d.style.opacity='0';});setTimeout(()=>d.remove(),500);},true);
});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(2000);
await pg.evaluate(async()=>{
  for(const n of state.library.slice()){ if(!n.ext){ state.library=state.library.filter(x=>x!==n); try{await libDbDelete(n.id);}catch(_){} } }
  for(const id of ['456','127','1567','752','628','424'].reverse()){const t=await azFetch(id+'.txt','text');await azAddNovel(azParse(t),{id:'az'+id});}
  const K=['봄비가 조용히 내리는 저녁이었다.','그녀는 오래된 편지를 천천히 다시 읽었다.','창밖으로 작은 불빛들이 하나둘 켜지기 시작했다.','“내일은 꼭 만나러 갈게.”','편지 마지막 줄에는 그렇게 적혀 있었다.','그녀는 미소를 지으며 편지를 가슴에 안았다.'];
  const kn=makeNovel('봄날의 편지');kn.episodes=[makeEpisode(1,'1화',[{paras:K.map(t=>({type:'text',text:t,align:'left',size:17,color:'#1a1208'}))}])];kn.episodes[0].charCount=200;kn.koMode='on';
  await libDbPut(kn);state.library.push(kn);window._kn=kn.id;
  const w=koLoad();const add=(k,m)=>{w[k]={h:k,m,show:true,ms:[{m,c:''}],at:new Date().toISOString(),due:'2099-01-01',ivl:3,ease:2.5,reps:1};};
  add('편지','手紙');add('저녁','夕方');add('불빛','明かり');add('미소','微笑み');koSaveWords(true);
  const g=state.library.find(n=>n.ext&&n.ext.id==='az456');const eps=g.episodes.slice().sort((a,b)=>a.number-b.number);g.lastReadId=eps[0].id;await libDbPut(g);
  const m={};m[g.id]=Date.now();localStorage.setItem('ux-read-at',JSON.stringify(m));
  // 動画の頭から始めるため一度描き直し
  renderLibrary();window.scrollTo(0,0);
});
const fs=require('fs');const frames=[];let rec=true;
const cdp=await ctx.newCDPSession(pg);
const loop=(async()=>{while(rec){try{const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:90,clip:{x:0,y:0,width:390,height:844,scale:2}});const n=frames.length;fs.writeFileSync(`/tmp/claude-0/sc/f${String(n).padStart(5,'0')}.jpg`,Buffer.from(r.data,'base64'));frames.push(Date.now()/1000);}catch(_){await new Promise(r=>setTimeout(r,20));}}})();
async function koWait(ms){await pg.waitForTimeout(ms);}
const tapEl=async(sel,dx=0.5,dy=0.5)=>{const r=await pg.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height};},sel);if(r)await pg.touchscreen.tap(r.x+r.w*dx,r.y+r.h*dy);};
const scrollPage=async(dist,steps=30)=>{for(let i=0;i<steps;i++){await pg.evaluate(d=>{const p=document.querySelector('.page.cur');if(p)p.scrollTop+=d;},dist/steps);await pg.waitForTimeout(30);}};
await koWait(1200);
// 1. 続きを読む
await tapEl('.ux-cont');await koWait(2200);
await scrollPage(700,40);await koWait(500);
// 2. まんなかタップでバーを隠す
await pg.touchscreen.tap(195,450);await koWait(1300);
await scrollPage(500,30);await koWait(500);
await pg.touchscreen.tap(195,450);await koWait(1200);
// 3. 本棚へ → ＋ → 名作
await tapEl('#topbar-back-toc');await koWait(900);
await pg.evaluate(()=>showLibrary());await koWait(1000);
await tapEl('#library-fab');await koWait(1300);
await tapEl('.az-feature');await koWait(1500);
for(let i=0;i<20;i++){await pg.evaluate(()=>{const s=document.getElementById('az-sheet');s.scrollTop+=18;});await pg.waitForTimeout(40);}
await koWait(700);
await pg.evaluate(()=>azClose());await koWait(800);
// 4. 韓国語の本：単語をタップ
await pg.evaluate(async()=>{await openNovel(window._kn);openEpisode(state.novel.episodes[0].id);});await koWait(2000);
const pos=await pg.evaluate(()=>{const p=[...document.querySelectorAll('.page.cur p[data-qi]')][1];const r=p.getBoundingClientRect();return {x:r.left+60,y:r.top+r.height/2};});
await pg.touchscreen.tap(pos.x,pos.y);await koWait(2600);
await pg.evaluate(()=>{const s=document.getElementById('ko-sheet');if(s)s.scrollTop=0;});await koWait(800);
rec=false;await loop;fs.writeFileSync('/tmp/claude-0/sc/ts.json',JSON.stringify(frames));console.log(frames.length,errs);await b.close();})();
