const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.goto('http://localhost:8765/beta2/index.html'); await pg.waitForTimeout(2500);
const r=await pg.evaluate(async()=>{
  const mk=(t)=>({type:'text',text:t,runs:[{text:t}]});
  const paras=[];
  for(let i=0;i<3000;i++) paras.push(mk(i%150===5?('그는 '+i+'번째 사람을 보았다. 사람이 많았다.'):'오늘은 날씨가 좋다. 하늘이 맑았다.'));
  const n={id:'tn1',title:'テスト本',episodes:[{id:'e1',number:1,title:'第1話',pages:[{paras}]}],koTr:{}};
  state.library.push(n);
  n.koTr[koHash(koParaPlain(paras[155]))]='彼は155番目の人を見た。'; const w=koLoad(); w['사람']={h:'사람',ms:[{m:'人',c:''}],at:new Date().toISOString(),due:0,ivl:0,ease:2.5,reps:0}; koSaveWords(true);
  window._dbg={has:koNovelHasKo(n),plain:koParaPlain(paras[5]),fk:koFindKey("사람을"),fk2:koFindKey("사람이")};const t0=performance.now(); const res=await koUsesSearch('사람',40); const dt=performance.now()-t0;
  koEditFromList(encodeURIComponent('사람'));
  await new Promise(r=>setTimeout(r,800));
  return {dbg:window._dbg,dt, n:res.list.length, first:res.list[0], html:(document.getElementById('ko-uses')||{}).innerText};
});
console.log(JSON.stringify(r,null,1).slice(0,1500));
await pg.screenshot({path:'/tmp/claude-0/uses.png'});
// quiz path
const q=await pg.evaluate(async()=>{koCloseSheet(); openKoQuiz({keys:['사람']}); await new Promise(r=>setTimeout(r,300)); koQuizShow(true); await new Promise(r=>setTimeout(r,600)); const el=document.getElementById('ko-quiz-use'); return el?{hid:el.hidden,t:el.innerText}:'none';});
console.log('quiz',JSON.stringify(q));
await pg.screenshot({path:'/tmp/claude-0/quiz.png'});
const j=await pg.evaluate(async()=>{koCloseSheet(); koEditFromList(encodeURIComponent('사람')); await new Promise(r=>setTimeout(r,500)); const more=document.querySelector('.ko-uses-more'); if(more) more.click(); await new Promise(r=>setTimeout(r,300)); const cnt=document.querySelectorAll('.ko-use').length; koUseJump(2); await new Promise(r=>setTimeout(r,2500)); return {cnt,nid:state.currentNovelId,ep:state.currentEpisodeId,page:state.curPage,flash:!!document.querySelector('p.ko-use-flash'), u:window._koUses[2].qi};});
console.log('jump',JSON.stringify(j)); await pg.screenshot({path:'/tmp/claude-0/jump.png'});
console.log('errs',errs);
await b.close();})();
