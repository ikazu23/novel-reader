const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const out={};
for(const ios of [true,false]){
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1':undefined});
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await ctx.addInitScript(()=>{window._fakeIOS=/iPhone/.test(navigator.userAgent);
  // キーボードのまねをする visualViewport
  const et=new EventTarget();const vv={offsetTop:0,height:innerHeight,width:innerWidth,scale:1,addEventListener:et.addEventListener.bind(et),removeEventListener:et.removeEventListener.bind(et)};
  window._kb=(kb,off)=>{vv.offsetTop=off;vv.height=innerHeight-kb-off;et.dispatchEvent(new Event('resize'));};
  Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(1800);
const box=()=>pg.evaluate(()=>{const bb=document.getElementById('botbar').getBoundingClientRect(),vp=document.getElementById('viewport').getBoundingClientRect(),tb=document.getElementById('topbar').getBoundingClientRect();return {bbTop:Math.round(bb.top),bbBottom:Math.round(bb.bottom),pad:getComputedStyle(document.getElementById('botbar')).paddingBottom,vpTop:Math.round(vp.top),vpBottom:Math.round(vp.bottom),tbBottom:Math.round(tb.bottom),cls:document.body.classList.contains('ios-bar-top')};});
await pg.evaluate(async()=>{const n=makeNovel('本');n.episodes=[makeEpisode(1,'1',[{paras:[{type:'text',text:'あいうえお',html:'あいうえお',size:15}]}])];await libDbPut(n);state.library.push(n);await openNovel(n.id);openEpisode(n.episodes[0].id);});
await pg.waitForTimeout(500);const k=ios?'ios':'other';out[k]={};
out[k].read=await box();
await pg.evaluate(()=>enterEditMode());await pg.waitForTimeout(600);out[k].editTop=await box();
await pg.screenshot({path:`/tmp/claude-0/ios_${k}_edit.png`});
await pg.evaluate(()=>_kb(300,120));await pg.waitForTimeout(300);out[k].editTopKb=await box();
await pg.evaluate(()=>{_kb(0,0);if(typeof iosSetBarPos==='function')iosSetBarPos('bottom');});await pg.waitForTimeout(300);out[k].editBottom=await box();
await pg.screenshot({path:`/tmp/claude-0/ios_${k}_bottom.png`});
await pg.evaluate(()=>_kb(300,0));await pg.waitForTimeout(300);out[k].editBottomKb=await box();
await pg.evaluate(()=>{_kb(0,0);exitEditMode();});await pg.waitForTimeout(500);out[k].readAgain=await box();
out[k].row=await pg.evaluate(async()=>{togglePanel();await new Promise(r=>setTimeout(r,300));uxPanelTab('etc');const r=document.getElementById('ios-bar-row');return r?r.innerText.replace(/\n/g,' / '):null;});
if(ios) await pg.screenshot({path:'/tmp/claude-0/ios_panel.png'});
if(ios){
  out[k].adj=await pg.evaluate(async()=>{closePanel&&closePanel();const r={};const B=()=>{const bb=document.getElementById('botbar').getBoundingClientRect();return [Math.round(bb.top),Math.round(bb.bottom),getComputedStyle(document.getElementById('botbar')).paddingBottom];};
    enterEditMode();await new Promise(x=>setTimeout(x,500));
    iosSetBarPos('top');iosAdjStep(false,8);await new Promise(x=>setTimeout(x,100));r.topNoKb=B();
    _kb(300,120);iosAdjStep(true,-4);await new Promise(x=>setTimeout(x,100));r.topKb=B();_kb(0,0);
    iosSetBarPos('bottom');iosAdjStep(false,12);await new Promise(x=>setTimeout(x,100));r.botNoKb=B();
    _kb(300,0);iosAdjStep(true,48);await new Promise(x=>setTimeout(x,100));r.botKb=B();_kb(0,0);
    togglePanel();await new Promise(x=>setTimeout(x,300));uxPanelTab('etc');r.ui=document.getElementById('ios-bar-row').innerText.replace(/\n/g,' / ');
    document.getElementById('ios-bar-row').scrollIntoView();
    return r;});
  await pg.screenshot({path:'/tmp/claude-0/ios_adj.png'});
  out[k].reset=await pg.evaluate(async()=>{iosAdjReset();await new Promise(x=>setTimeout(x,100));return [document.getElementById('ios-adj-0').textContent,document.getElementById('ios-adj-1').textContent,JSON.stringify(iosAdjAll())];});
}
out[k].errs=errs;await ctx.close();}
console.log(JSON.stringify(out,null,1));await b.close();})();
