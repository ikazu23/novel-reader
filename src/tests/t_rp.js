const {chromium}=require('playwright');
const page=process.argv[2]||'index.html';
(async()=>{const b=await chromium.launch();const out={};
for(const ios of [true,false]){
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'});
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
const toasts=[];await pg.exposeFunction('_t',t=>toasts.push(t));
await pg.addInitScript(()=>{const iv=setInterval(()=>{if(typeof showToast==='function'&&!showToast._w){const o=showToast;showToast=function(t){window._t(t);return o.apply(this,arguments);};showToast._w=1;clearInterval(iv);}},20);});
await pg.goto('http://localhost:8765/'+page);await pg.waitForTimeout(1800);
const k=ios?'ios':'android';const o=out[k]={};
await pg.evaluate(async()=>{const P=t=>({type:'text',text:t,html:t,align:'left',size:15,color:'#222'});
  const n=makeNovel('ORV');n.id='nv_orv';
  n.episodes=[1,2,3].map(i=>{const paras=[];for(let j=0;j<120;j++)paras.push(P(i+'話の'+j+'段落 あいうえおかきくけこさしすせそたちつてと'));const pages=i===2?[{paras:paras.slice(0,60)},{paras:paras.slice(60)}]:[{paras}];const e=makeEpisode(i,'第'+i+'話',pages);e.id='e'+i;e.charCount=countChars(pages);return e;});
  await libDbPut(n);state.library.push(n);showLibrary();});
// 1) 1話を開いて途中までスクロール → 読み込み直し
await pg.evaluate(async()=>{await openNovel('nv_orv');openEpisode('e1');await new Promise(r=>setTimeout(r,500));document.getElementById('page-0').scrollTop=1500;await new Promise(r=>setTimeout(r,900));});
await pg.reload();await pg.waitForTimeout(3000);
o.reload=await pg.evaluate(()=>({ep:state.currentEpisodeId,top:Math.round((document.getElementById('page-0')||{}).scrollTop||0)}));
o.toast=toasts.filter(t=>/読んでいた/.test(t));
// 2) 2話の2ページ目を読んでから目次へ → 読み込み直し → 本棚のまま、「続きから読む」でその場所へ
await pg.evaluate(async()=>{if(!state.currentNovelId)await openNovel('nv_orv');openEpisode('e2');await new Promise(r=>setTimeout(r,400));goToPage(1);await new Promise(r=>setTimeout(r,700));document.getElementById('page-1').scrollTop=800;await new Promise(r=>setTimeout(r,900));showToc();});
await pg.reload();await pg.waitForTimeout(3000);
o.afterToc=await pg.evaluate(()=>({ep:state.currentEpisodeId,lib:document.getElementById('library-screen').classList.contains('show')}));
o.continue=await pg.evaluate(async()=>{uxContinue('nv_orv');await new Promise(r=>setTimeout(r,1800));return {ep:state.currentEpisodeId,page:state.curPage,top:Math.round(document.getElementById('page-'+state.curPage).scrollTop)};});
// 3) 横スワイプ（1話・1ページだけの話で）
const swipe=async(x0,y0,x1,y1,scrollDuring)=>pg.evaluate(async([x0,y0,x1,y1,sd])=>{
  await openEpisode('e1');await new Promise(r=>setTimeout(r,500));const el=document.getElementById('page-0');el.scrollTop=600;await new Promise(r=>setTimeout(r,100));
  const T=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
  el.dispatchEvent(new TouchEvent('touchstart',{touches:[T(x0,y0)],changedTouches:[T(x0,y0)],bubbles:true}));
  const mx=(x0+x1)/2,my=(y0+y1)/2+sd.mid;el.dispatchEvent(new TouchEvent('touchmove',{touches:[T(mx,my)],changedTouches:[T(mx,my)],bubbles:true}));
  if(sd.scroll) el.scrollTop+=sd.scroll;
  el.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[T(x1,y1)],bubbles:true}));
  await new Promise(r=>setTimeout(r,700));return state.currentEpisodeId;},[x0,y0,x1,y1,scrollDuring]);
o.diagonal=await swipe(250,500,180,460,{mid:0,scroll:0});      // 70px 横・40px 縦
o.scrollArc=await swipe(300,600,190,560,{mid:-80,scroll:120}); // 縦スクロール中のななめ
o.strong=await swipe(320,500,160,490,{mid:0,scroll:0});        // しっかり横
o.edge=await swipe(380,500,230,495,{mid:0,scroll:0});          // 右端から
o.errs=errs;await ctx.close();}
console.log(JSON.stringify(out,null,1));await b.close();})();
