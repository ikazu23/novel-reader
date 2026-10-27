const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:800}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>{errs.push('dialog:'+d.message().slice(0,50));d.accept();});
const now=new Date().toISOString();
const G=['ファンタジー','恋愛','ミステリー','SF','日常','ホラー'];
const works=Array.from({length:14},(_,i)=>({id:'w'+i,title:['星降る夜の図書館','となりの魔女さん','雨宿りの探偵','月面コンビニ','猫とわたしの百日','夜の学校'][i%6]+(i>5?' '+i:''),author:['みずき','そら','いかすみ','はる'][i%4],ak:'ak'+(i%4),genre:G[i%6],epCount:3+i,chars:12000+i*3000,likes:20-i,updatedAt:now,done:i%3===0,tags:['短編','ほのぼの'],synopsis:'あらすじです。'.repeat(5),status:'public'}));
await pg.route(/workers\.dev/,async route=>{const u=new URL(route.request().url());const p=u.pathname;let body={};
 if(p==='/works') body={works:works,rankAvailable:true};
 else if(/^\/w\/[^/]+$/.test(p)){const w=works.find(x=>'/w/'+x.id===p);body=Object.assign({},w,{status:'public'});}
 else if(/\/index$/.test(p)){const id=p.split('/')[2];const w=works.find(x=>x.id===id);body={title:w.title,author:w.author,genre:w.genre,episodes:Array.from({length:w.epCount},(_,k)=>({id:'e'+k,number:k+1,title:'第'+(k+1)+'話',updatedAt:now,charCount:3000})),updatedAt:now};}
 else if(/\/ep\//.test(p)){body={pages:[{paras:[{type:'text',text:'本文です。',align:'left',size:15,color:'#222'}]}],status:'public'};}
 else body={ok:true};
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});});
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(2500);
await pg.screenshot({path:'/tmp/claude-0/sh0_lib.png'});
await pg.evaluate(()=>openBrowse());await pg.waitForTimeout(1500);await pg.screenshot({path:'/tmp/claude-0/sh1_browse.png'});
await pg.evaluate(()=>openWorkDetail('w0'));await pg.waitForTimeout(1500);await pg.screenshot({path:'/tmp/claude-0/sh2_work.png'});
await pg.evaluate(()=>addWorkToLibrary('w0'));await pg.waitForTimeout(2500);
const o=await pg.evaluate(()=>({cur:state.currentNovelId,eps:state.novel&&state.novel.episodes.length,shared:document.body.classList.contains('shared-mode'),badge:!!document.getElementById('beta-badge'),isBeta:IS_BETA,lsp:LS_PREFIX,db:DB_NAME,terms:TERMS_URL,share:workShareUrl('x')}));
console.log(o);
await pg.screenshot({path:'/tmp/claude-0/sh3_toc.png'});
console.log('errs',errs);await b.close();})();
