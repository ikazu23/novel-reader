const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:844}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({works:[],rankAvailable:true})}));
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(2000);
await pg.evaluate(()=>{openBrowse();browseList({sort:'popular'});});await pg.waitForTimeout(600);
const o={};
await pg.evaluate(()=>{const c=document.querySelector('.bl-chips');c.scrollLeft=400;});o.before=await pg.evaluate(()=>document.querySelector('.bl-chips').scrollLeft);
await pg.evaluate(()=>{const b=[...document.querySelectorAll('.bl-chips button')].find(x=>x.textContent==='ミステリー');b.click();});await pg.waitForTimeout(600);
o.after=await pg.evaluate(()=>document.querySelector('.bl-chips').scrollLeft);
o.onVisible=await pg.evaluate(()=>{const c=document.querySelector('.bl-chips');const on=c.querySelector('button.on');const r=on.getBoundingClientRect(),cr=c.getBoundingClientRect();return on.textContent+' '+(r.left>=cr.left&&r.right<=cr.right);});
await pg.evaluate(()=>{const b=[...document.querySelectorAll('.bl-chips button')].find(x=>x.textContent==='完結のみ');b.click();});await pg.waitForTimeout(600);
o.afterDone=await pg.evaluate(()=>document.querySelector('.bl-chips').scrollLeft);
// ホームのジャンルから入ったとき（最初）：選んだジャンルが見える
await pg.evaluate(()=>{browseHome();browseList({genre:'歴史',sort:'popular'});});await pg.waitForTimeout(600);
o.fromHome=await pg.evaluate(()=>{const c=document.querySelector('.bl-chips');const on=c.querySelector('button.on');const r=on.getBoundingClientRect(),cr=c.getBoundingClientRect();return on.textContent+' '+(r.left>=cr.left&&r.right<=cr.right);});
console.log(o,errs);await b.close();})();
