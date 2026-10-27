// 投稿機能の紹介：本を作る→書く→太字・斜体・流れる文字・囲み・挿絵→読む→公開→作品をさがす
const {chromium}=require('playwright');const fs=require('fs');
const REC=process.argv[2]==='rec';
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
const now=new Date().toISOString();
let demoWork=null;
await pg.route(/workers\.dev/,async r=>{const p=new URL(r.request().url()).pathname;let body={ok:true};
  if(p==='/works') body={works:demoWork?[demoWork]:[],rankAvailable:true};
  else if(demoWork&&p==='/w/'+demoWork.id) body=Object.assign({},demoWork,{status:'public'});
  else if(demoWork&&p==='/w/'+demoWork.id+'/index') body={title:demoWork.title,author:demoWork.author,episodes:[{id:'e1',number:1,title:'第1話 最終列車',updatedAt:now,charCount:120}],updatedAt:now};
  await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
await pg.addInitScript(()=>{try{localStorage.setItem('ux-tip-tap','1');localStorage.setItem('az-banner-off','1');}catch(_){}
  document.addEventListener('pointerdown',e=>{const d=document.createElement('div');d.style.cssText=`position:fixed;left:${e.clientX-22}px;top:${e.clientY-22}px;width:44px;height:44px;border-radius:50%;background:rgba(0,128,128,.28);border:2px solid rgba(0,128,128,.6);z-index:99999;pointer-events:none;transition:transform .45s,opacity .45s;`;document.documentElement.appendChild(d);requestAnimationFrame(()=>{d.style.transform='scale(1.6)';d.style.opacity='0';});setTimeout(()=>d.remove(),500);},true);});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(2000);
await pg.evaluate(async()=>{for(const n of state.library.slice()){state.library=state.library.filter(x=>x!==n);try{await libDbDelete(n.id);}catch(_){} }
  for(const id of ['127','456']){const t=await azFetch(id+'.txt','text');await azAddNovel(azParse(t),{id:'az'+id});}
  gdriveIsSignedIn=()=>true; window.penName=()=>'いかすみ';
  renderLibrary();});
await pg.waitForTimeout(800);
// 録画
const frames=[];let rec=REC;const cdp=await ctx.newCDPSession(pg);
if(REC){fs.rmSync('/tmp/claude-0/sc2',{recursive:true,force:true});fs.mkdirSync('/tmp/claude-0/sc2');}
const loop=(async()=>{while(rec){try{const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:90,clip:{x:0,y:0,width:390,height:844,scale:2}});fs.writeFileSync(`/tmp/claude-0/sc2/f${String(frames.length).padStart(5,'0')}.jpg`,Buffer.from(r.data,'base64'));frames.push(Date.now()/1000);}catch(_){await new Promise(r=>setTimeout(r,20));}}})();
const W=ms=>pg.waitForTimeout(ms);
let shotN=0;const SH=async n=>{if(!REC)await pg.screenshot({path:`/tmp/claude-0/demo/s${String(++shotN).padStart(2,'0')}_${n}.png`});};
const box=sel=>pg.evaluate(s=>{const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<innerHeight&&getComputedStyle(e).visibility!=='hidden';};
  let e=[...document.querySelectorAll(s)].find(vis);if(!e){const c=document.querySelector(s);if(!c)return null;const bar=c.closest('[id^=eb], .eb-scroll, #edit-bar');if(bar&&c.scrollIntoView)c.scrollIntoView({block:'nearest',inline:'center'});e=[...document.querySelectorAll(s)].find(vis);if(!e)return null;}
  if(e.closest('.eb-btn, #eb, [id^="eb-"]')||e.classList.contains('eb-btn'))e.scrollIntoView({block:'nearest',inline:'center'});const r=e.getBoundingClientRect();
  // その場所で本当にその要素が押されるか
  const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!(hit===e||e.contains(hit)))return {x:r.left+r.width/2,y:r.top+r.height/2,miss:true,sel:s};
  return {x:r.left+r.width/2,y:r.top+r.height/2};},sel);
const tap=async sel=>{let p=await box(sel);if(p&&p.miss){await pg.evaluate(s=>{const e=document.querySelector(s);e&&e.scrollIntoView({block:'center',behavior:'smooth'});},sel);await W(700);p=await box(sel);}if(!p||p.miss){console.log('NO/MISS',sel,JSON.stringify(p));return false;}await pg.touchscreen.tap(p.x,p.y);return true;};
const selText=(txt)=>pg.evaluate(t=>{const ed=document.querySelector('.page.cur .page-editor');const w=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const i=n.textContent.indexOf(t);if(i>=0){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+t.length);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));return true;}}return false;},txt);
const caretIn=(qi,end)=>pg.evaluate(([q,e])=>{const p=document.querySelector(`.page.cur p[data-qi="${q}"]`);if(!p)return false;const r=document.createRange();r.selectNodeContents(p);r.collapse(!e);const s=getSelection();s.removeAllRanges();s.addRange(r);p.closest('.page-editor').focus();document.dispatchEvent(new Event('selectionchange'));return true;},[qi,!!end]);
await W(1200);await SH('lib');
// 1. 本を作る
await tap('#library-fab');await W(1100);await SH('add');
await tap('.az-row');await W(1500);await SH('toc');
// 題名
await tap('#toc-novel-title');await W(300);
await pg.evaluate(()=>{const t=document.getElementById('toc-novel-title');const r=document.createRange();r.selectNodeContents(t);const s=getSelection();s.removeAllRanges();s.addRange(r);});
await pg.keyboard.type('星降る駅で',{delay:90});await W(300);
await tap('#toc-novel-author');await W(200);await pg.evaluate(()=>{const t=document.getElementById('toc-novel-author');const r=document.createRange();r.selectNodeContents(t);const s=getSelection();s.removeAllRanges();s.addRange(r);});
await pg.keyboard.type('いかすみ',{delay:80});await pg.evaluate(()=>document.activeElement.blur());await W(600);await SH('title');
// 2. 1話を開いて書く
await tap('.toc-ep');await W(1300);
await pg.touchscreen.tap(195,300);await W(90);await pg.touchscreen.tap(195,300);await W(900);
if(!(await pg.evaluate(()=>state.editMode))){await pg.evaluate(()=>enterEditMode());await W(600);}
await caretIn(0,true);await W(200);
const lines=['まもなく 星降る駅 に到着します','　最終列車の窓から、わたしは夜空を見上げた。','「また明日ね」','　あの日の約束は、まだ胸の奥で光っている。'];
for(let i=0;i<lines.length;i++){await pg.keyboard.type(lines[i],{delay:38});if(i<lines.length-1){await pg.keyboard.press('Enter');await W(120);}}
await W(500);await SH('typed');
// 太字・斜体
await selText('約束');await W(800);await tap('[data-fmt="bold"]');await W(700);
await selText('夜空');await W(800);await tap('[data-fmt="italic"]');await W(700);await SH('fmt');console.log('fmt', await pg.evaluate(()=>document.querySelector('.page.cur .page-editor').innerHTML.slice(0,400)));
// 流れる文字
await caretIn(0,true);await W(300);await tap('#eb-mq-btn');await W(900);await SH('mq');
await tap('.kzs-ok');await W(900);
// 囲み（システム）
await caretIn(0,true);await W(300);await tap('#eb-box-btn');await W(900);
await tap('.bxs-opt[data-s="sys"]');await W(600);await SH('box');await tap('.kzs-ok');await W(900);
// 挿絵（最後に）
await caretIn(3,true);await W(300);
await tap('[title="挿絵を追加"]');await W(300);
await pg.setInputFiles('#img-picker-input','/tmp/claude-0/demo/hoshifuru.jpg');await W(1500);await SH('img');
// 3. 読む
const st=await pg.evaluate(()=>({edit:state.editMode,paras:JSON.stringify(state.pages[0].paras).slice(0,600)}));console.log(st);
await tap('#topbar-edit-done');await W(300);
if(await pg.evaluate(()=>state.editMode)){await pg.evaluate(()=>exitEditMode());}
await W(1500);
if(await pg.evaluate(()=>document.getElementById('toc-screen')&&getComputedStyle(document.getElementById('toc-screen')).display!=='none'&&!state.editMode&&!document.querySelector('.page.cur .pmq'))){}
await SH('read');await W(2500);
await pg.evaluate(()=>{const p=document.querySelector('.page.cur');p.scrollTo({top:p.scrollHeight,behavior:'smooth'});});await W(1800);await SH('read2');
// 4. 公開
await pg.evaluate(()=>{publishCurrentNovel=async()=>{return {workId:'demo1',changed:1};};});
await pg.evaluate(()=>showToc());await W(1000);
await tap('#ux-toc-acts .ux-ta:not(.main)');await W(1000);
await pg.selectOption('#pub-genre','ファンタジー');await W(300);
await tap('#pub-tags');await pg.keyboard.type('鉄道 星空 ほのぼの',{delay:60});await W(300);
await tap('#pub-synopsis');await pg.keyboard.type('最終列車で出会った、ふしぎな駅のお話。',{delay:45});await W(300);
await tap('#pub-self');await W(400);await SH('pub');
await pg.evaluate(()=>{const n=state.novel;window._demoW={id:'demo1',title:n.title,author:'いかすみ',ak:'akdemo',genre:'ファンタジー',epCount:1,chars:120,likes:12,updatedAt:new Date().toISOString(),done:false,tags:['鉄道','星空','ほのぼの'],synopsis:'最終列車で出会った、ふしぎな駅のお話。',cover:''};});
demoWork=await pg.evaluate(()=>window._demoW);
await tap('#modal-ok');await W(1600);await SH('published');
await pg.evaluate(()=>closeModal());await W(500);
// 5. 作品をさがす
await pg.evaluate(()=>showLibrary());await W(900);
await tap('#library-topbar .lib-tb-btn, button[title="作品をさがす"]');await W(1800);await SH('browse');
await tap('.bw-card, .rk-item');await W(1800);await SH('work');
await W(1000);
rec=false;await loop;
if(REC)fs.writeFileSync('/tmp/claude-0/sc2/ts.json',JSON.stringify(frames));
console.log('frames',frames.length,errs);await b.close();})();
