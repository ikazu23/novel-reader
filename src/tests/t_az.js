const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/'+(process.argv[2]||'beta2/index.html'));await pg.waitForTimeout(2500);
const r=await pg.evaluate(async()=>{
 const cat=await azFetch('catalog.json','json'); const out=[];
 for(const w of cat.works){const t=await azFetch(w.file,'text');const p=azParse(t,w.title);
  const all=p.eps.flatMap(e=>e.pages.flatMap(pg=>pg.paras));
  const html=all.map(x=>x.html).join('\n');
  out.push({t:p.title,a:p.author,sub:p.subtitle,eps:p.eps.length,pages:p.eps.reduce((a,e)=>a+e.pages.length,0),epTitles:p.eps.slice(0,4).map(e=>e.title).join('|'),ruby:(html.match(/<ruby>/g)||[]).length,leftNote:(html.match(/［＃/g)||[]).length,leftRuby:(html.match(/《/g)||[]).length,pipe:(html.match(/｜/g)||[]).length,emph:(html.match(/text-emphasis/g)||[]).length,credit:p.credit.length,gaiji:(html.match(/※/g)||[]).length});}
 return out;});
r.forEach(x=>console.log(JSON.stringify(x)));
console.log('errs',errs);await b.close();})();
