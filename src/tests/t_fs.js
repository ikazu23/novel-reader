const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800}});
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
const url='http://localhost:8765/'+(process.argv[2]||'index.html');
await pg.goto(url);await pg.waitForTimeout(1800);const o={};
const P=(t,s,h)=>({type:'text',text:t,html:h||t,align:'left',size:s,color:'#222'});
await pg.evaluate(async(P)=>{P=eval(P);
  const mk=(id,t,eps)=>{const n=makeNovel(t);n.id=id;n.episodes=eps.map((ps,i)=>{const e=makeEpisode(i+1,'第'+(i+1)+'話',[{paras:ps}]);e.id=id+'_e'+i;e.charCount=countChars(e.pages);return e;});return n;};
  const A=mk('nv_A','韓国の本',[[P('見出し',26),P('本文あいうえおかきくけこ',13),P('本文さしすせそ',13,'本文<span style="font-size:20px">大</span>さしすせそ')],[P('本文たちつてと',13)]]);
  const B=mk('nv_B','ふつうの本',[[P('ふつうの本文です',15)]]);
  for(const n of [A,B]){await libDbPut(n);state.library.push(n);} renderLibrary();
},`(${P.toString()})`);
// 1) この本の標準（初期値＝いちばん多い大きさ）
o.modeA=await pg.evaluate(async()=>{await openNovel('nv_A');openEpisode('nv_A_e0');await new Promise(r=>setTimeout(r,300));togglePanel();await new Promise(r=>setTimeout(r,300));return {std:stdFont(),val:document.getElementById('fs-std-val').textContent,scopeVisible:getComputedStyle(document.getElementById('fs-scope-row')).display!=='none',tab:document.getElementById('fs-std-row').dataset.uxT};});
await pg.screenshot({path:'/tmp/claude-0/fs_panel.png'});
o.plusBook=await pg.evaluate(async()=>{fsSetScope('book');fsAdjustStd(1);await new Promise(r=>setTimeout(r,300));
  const n=state.novel;return {std:n.fontStd,e0:n.episodes[0].pages[0].paras.map(p=>p.size),e0span:n.episodes[0].pages[0].paras[2].html,e1:n.episodes[1].pages[0].paras.map(p=>p.size),dom:getComputedStyle(document.querySelector('.page-editor p[data-qi="1"]')||document.body).fontSize,B:state.library.find(x=>x.id==='nv_B').episodes[0].pages[0].paras[0].size};});
// 2) 新しい話は標準の大きさ
o.newEp=await pg.evaluate(async()=>{showToc();const ep=makeEpisode(3,'第3話',[{paras:[]}]);state.novel.episodes.push(ep);save();openEpisode(ep.id);await new Promise(r=>setTimeout(r,300));return state.pages[0].paras.map(p=>p.size);});
// 3) 貼り付け（コピー元の20pxは使わない）
o.paste=await pg.evaluate(async()=>{enterEditMode();await new Promise(r=>setTimeout(r,300));const ed=document.querySelector('.page.cur .page-editor')||document.querySelector('.page-editor');const p=ed.querySelector('p');p.focus();const r=document.createRange();r.selectNodeContents(p);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);
  const dt=new DataTransfer();dt.setData('text/html','<p style="font-size:20px;line-height:3">一行目<span style="font-size:24px">大</span></p><p style="font-size:20px">二行目</p>');dt.setData('text/plain','一行目大\n二行目');
  ed.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,100));syncEditorToState(state.curPage);
  return state.pages[0].paras.map(p=>[p.text,p.size,p.html]);});
await pg.evaluate(()=>{try{exitEditMode();}catch(_){} showToc();showLibrary();});
// 4) 全部の本（文字の標準・行間）
o.all=await pg.evaluate(async()=>{await openNovel('nv_A');openEpisode('nv_A_e0');await new Promise(r=>setTimeout(r,300));togglePanel();fsSetScope('all');
  storeLookSetting('lineHeight',2.6); // この本だけの行間を先に作る
  fsAdjustStd(1);fsAdjustStd(1); await new Promise(r=>setTimeout(r,1500));
  adjustLineHeight(-0.2);await new Promise(r=>setTimeout(r,300));
  const A=state.novel,B=state.library.find(x=>x.id==='nv_B');
  return {global:state.settings.fontSize,A:A.episodes[0].pages[0].paras.map(p=>p.size),Astd:A.fontStd,B:B.episodes[0].pages[0].paras[0].size,lhGlobal:state.settings.lineHeight,lhA:A.lineHeight,val:document.getElementById('fs-std-val').textContent};});
// 5) イカ墨翻訳から、開いていない本に届いた話（その本の標準×比率）
o.kz=await pg.evaluate(async()=>{showToc();showLibrary();const B=state.library.find(x=>x.id==='nv_B');B.fontStd=12;
  const paras=kzItemsToParas([{text:'ふつう',html:'ふつう'},{text:'大きい',html:'大きい',sizeRatio:1.5}],stdFont(B));return paras.map(p=>p.size);});
// 6) みんなの作品のダウンロード（作者の16px → 全部の本の標準）
o.shared=await pg.evaluate(async()=>{const P2=(t,s)=>({type:'text',text:t,html:t,align:'left',size:s,color:'#222'});
  const eps=[{id:'x',pages:[{paras:[P2('作者の本文です',16),P2('見出し',24)]}]}];
  fsFitShared('zz',eps);const r1=eps[0].pages[0].paras.map(p=>p.size);
  const B=state.library.find(x=>x.id==='nv_B');const sh=JSON.parse(JSON.stringify(B));sh.id='shared_yy';sh.fontStd=12;state.library.push(sh);
  const eps2=[{id:'y',pages:[{paras:[P2('作者の本文です',16),P2('見出し',24)]}]}];fsFitShared('yy',eps2);
  return {newBook:r1,existing:eps2[0].pages[0].paras.map(p=>p.size)};});
// 7) 開き直しても残る
await pg.reload();await pg.waitForTimeout(1800);
o.reload=await pg.evaluate(()=>({global:state.settings.fontSize,A:state.library.find(x=>x.id==='nv_A').episodes[0].pages[0].paras.map(p=>p.size)}));
console.log(JSON.stringify(o,null,1),errs);await b.close();})();
