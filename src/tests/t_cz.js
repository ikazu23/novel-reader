const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/'+(process.argv[2]||'beta2/index.html'));await pg.waitForTimeout(2500);
const r=await pg.evaluate(async()=>{
 const S=['그는 천천히 고개를 들어 하늘을 바라보았다.','"정말 그렇게 생각해?" 그녀가 물었다.','바람이 불어와 머리카락이 흩날렸다.','나는 아무 말도 하지 못하고 그 자리에 서 있었다.','어둠 속에서 누군가의 발소리가 들려왔다.'];
 const mk=(t)=>({type:'text',text:t,runs:[{text:t}]});
 const pages=[];for(let p=0;p<5;p++){const paras=[];for(let q=0;q<10;q++)paras.push(mk(S[(p+q)%5]));pages.push({paras});}
 const n={id:'cz1',title:'穴埋め本',episodes:[{id:'e1',number:1,title:'第1話',pages}],koTr:{}};
 n.koTr[koHash(S[2])]='風が吹いてきて髪がなびいた。';
 state.library.push(n);
 const w=koLoad(); const add=(k,m)=>w[k]={h:k,ms:[{m,c:''}],at:new Date().toISOString(),due:0,ivl:0,ease:2.5,reps:0};
 add('고개','首');add('하늘','空');add('바람','風');add('어둠','闇');add('발소리','足音');add('자리','場所'); w['흩날리다']={h:'흩날리다',ks:['흩날'],ms:[{m:'舞い散る',c:''}],at:new Date().toISOString(),due:0,ivl:0,ease:2.5,reps:0};
 koSaveWords(true);
 const o={};
 // fav
 koEditFromList(encodeURIComponent('바람')); await new Promise(r=>setTimeout(r,600));
 koUseFavAdd(0); await new Promise(r=>setTimeout(r,300));
 o.fav=koLoad()['바람'].fav; o.favRow=!!document.querySelector('.ko-use.fav'); o.u=!!koLoad()['바람'].u;
 o.usesText=document.getElementById('ko-uses').innerText.slice(0,200);
 // quiz back uses fav
 o.back=koQuizBack('바람',koLoad()['바람']).includes('흩날렸다');
 koUseFavDel(0); await new Promise(r=>setTimeout(r,300)); o.favAfterDel=koLoad()['바람'].fav;
 koUseFavAdd(0); await new Promise(r=>setTimeout(r,200));
 // cloze
 await openKoCloze(); 
 o.q=_koCz.qs.length; o.qs=_koCz.qs.map(x=>x.k+':'+x.s);
 o.blank=document.getElementById('ko-cz-s').innerText; o.choices=[...document.querySelectorAll('.ko-cz-c')].map(b=>b.textContent);
 koClozeHint(); o.hint=document.querySelector('.ko-cz-hintv').textContent;
 // answer all: first correct, rest wrong-ish
 let first=true;
 while(_koCz.i<_koCz.qs.length){const it=_koCz.qs[_koCz.i];const h=koHead(it.k,koLoad()[it.k]);const j=first?it.choices.indexOf(h):it.choices.findIndex(c=>c!==h);first=false;koClozeAnswer(j);_koCz.i++;koClozeShow();}
 o.done=document.getElementById('ko-sheet-body').innerText;
 return o;});
console.log(JSON.stringify(r,null,1));await pg.screenshot({path:'/tmp/claude-0/cz_done.png'});
await pg.evaluate(async()=>{await openKoCloze();});await pg.screenshot({path:'/tmp/claude-0/cz_q.png'});
await pg.evaluate(()=>{koClozeAnswer(0)});await pg.screenshot({path:'/tmp/claude-0/cz_a.png'});
await pg.evaluate(async()=>{koCloseSheet();koEditFromList(encodeURIComponent('바람'));await new Promise(r=>setTimeout(r,600));document.getElementById('ko-uses').scrollIntoView();});await pg.screenshot({path:'/tmp/claude-0/fav.png'});
console.log('errs',errs);await b.close();})();
