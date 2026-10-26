const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
const cdp=await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await pg.goto('http://localhost:8765/'+(process.argv[2]||'beta2/index.html'));await pg.waitForTimeout(3000);
const r=await pg.evaluate(async()=>{
 const S=['그는 천천히 고개를 들어 하늘을 바라보았다.','"정말 그렇게 생각해?" 그녀가 물었다.','바람이 불어와 머리카락이 흩날렸다.','나는 아무 말도 하지 못하고 그 자리에 서 있었다.','어둠 속에서 누군가의 발소리가 들려왔다.'];
 const mk=(t)=>({type:'text',text:t,runs:[{text:t}]});
 const eps=[];for(let e=0;e<3;e++){const pages=[];for(let p=0;p<15;p++){const paras=[];for(let q=0;q<25;q++)paras.push(mk(S[(e+p+q)%5]+' '+S[(q*3)%5]));pages.push({paras});}eps.push({id:'e'+e,number:e+1,title:'第'+(e+1)+'話',pages});}
 const n={id:'pn1',title:'重い本',episodes:eps,koTr:{},updatedAt:new Date().toISOString()};
 state.library.push(n);
 const w=koLoad(); ['고개','하늘'].forEach(k=>w[k]={h:k,ms:[{m:'くび',c:''}],at:new Date().toISOString(),due:0,ivl:0,ease:2.5,reps:0}); koSaveWords(true);
 await koDictLoad(); await openNovel('pn1'); openEpisode('e1'); await new Promise(r=>setTimeout(r,1500));
 const o={};
 const h=pi=>document.getElementById('page-'+pi).innerHTML;
 o.sample=document.querySelector('#page-'+state.curPage+' p[data-qi]').outerHTML.slice(0,700);o.before3=h(3).includes('data-kw="바람"');
 w['바람']={h:'바람',ms:[{m:'かぜ',c:''}],at:new Date().toISOString(),due:0,ivl:0,ease:2.5,reps:0}; koSaveWords(true);
 let t=performance.now(); koRerender(); o.rerender=Math.round(performance.now()-t);
 o.cur=h(state.curPage).includes('data-kw="바람"'); o.p3_now=h(3).includes('data-kw="바람"');
 goToPage(3); o.p3_after_flip=h(3).includes('data-kw="바람"');
 await new Promise(r=>{const c=()=>state.ui.transitioning?setTimeout(c,10):r();c();});
 await new Promise(r=>setTimeout(r,4000));
 o.allPages=state.pages.every((_,pi)=>h(pi).includes('data-kw="바람"'));
 o.curPage=state.curPage; o.cls=document.getElementById('page-3').className;
 // compare with full sync render
 const snap=state.pages.map((_,pi)=>h(pi)); state.pages.forEach((_,pi)=>refreshPage(pi)); o.identical=state.pages.every((_,pi)=>h(pi)===snap[pi]); {const pi=state.pages.findIndex((_,pi)=>h(pi)!==snap[pi]); if(pi>=0){const a=snap[pi],b2=h(pi);let i=0;while(a[i]===b2[i])i++; o.diff=[pi,i,a.length,b2.length,a.slice(Math.max(0,i-100),i+60),b2.slice(Math.max(0,i-100),i+60)];}}
 // rerender during transition
 goToPage(4); koRerender(); await new Promise(r=>setTimeout(r,1500)); o.afterMid=document.getElementById('page-4').className+'|'+state.curPage+'|'+document.querySelectorAll('.page.cur').length;
 // smoke
 const sm=[]; const tr=(nm,f)=>{try{f();sm.push(nm+':ok')}catch(e){sm.push(nm+':'+e.message)}};
 tr('wordlist',()=>openKoWordList()); tr('settings',()=>openKoSettings()); tr('close',()=>koCloseSheet()); tr('edit',()=>enterEditMode()); await new Promise(r=>setTimeout(r,800)); tr('rerenderInEdit',()=>koRerender()); o.smoke=sm; o.editMode=state.editMode;
 // backup
 localStorage.removeItem(LS_PREFIX+'bk-last'); let c=0; const og=backupGetAll; backupGetAll=(id)=>{c++;return og(id)};
 await autoBackup(n,false); const c1=c; await autoBackup(n,false); o.backupReads=[c1,c-c1]; o.bk=Object.keys(JSON.parse(localStorage.getItem(LS_PREFIX+'bk-last')||'{}'));
 const g=await og('pn1'); o.gens=g.generations.length;
 return o;});
console.log(r,errs);await b.close();})();
