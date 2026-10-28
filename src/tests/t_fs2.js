const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800}});
await ctx.route(/googleapis\.com|workers\.dev/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.goto('http://localhost:8765/'+(process.argv[2]||'index.html'));await pg.waitForTimeout(1800);
const o=await pg.evaluate(async()=>{const r={};
  // イカ墨翻訳から入れた話（13px）
  const n=makeNovel('K');n.id='nv_K';const pages=[{paras:kzItemsToParas([{text:'안녕',html:'안녕'},{text:'큰',html:'큰',sizeRatio:2}],13)}];
  const ep=makeEpisode(1,'1화',pages);ep.id='k1';ep.charCount=countChars(pages);ep.kzImport={key:'w1#1',n:0,cc:ep.charCount,h:kzPagesHash2(pages),hv:2};n.episodes=[ep];
  await libDbPut(n);state.library.push(n);
  r.before=kzUntouched(ep);
  await openNovel('nv_K');fsSetScope('book');fsAdjustStd(2);await new Promise(x=>setTimeout(x,200));
  const e2=state.novel.episodes[0];r.sizes=e2.pages[0].paras.map(p=>p.size);r.untouchedAfter=kzUntouched(e2);
  // 同じ話がもう一度届いた：同じとみなされる？
  r.sameAsResend=kzSameAsImported(e2,[{paras:kzItemsToParas([{text:'안녕',html:'안녕'},{text:'큰',html:'큰',sizeRatio:2}],stdFont(state.novel))}]);
  // ふつうの文字だけの貼り付け
  openEpisode('k1');await new Promise(x=>setTimeout(x,300));enterEditMode();await new Promise(x=>setTimeout(x,300));
  const ed=document.querySelector('.page-editor');const p=ed.querySelector('p');const rg=document.createRange();rg.selectNodeContents(p);rg.collapse(false);getSelection().removeAllRanges();getSelection().addRange(rg);
  const dt=new DataTransfer();dt.setData('text/plain','あ\nい\nう');ed.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
  await new Promise(x=>setTimeout(x,100));syncEditorToState(state.curPage);r.plain=state.pages[0].paras.map(p=>[p.text,p.size]);
  return r;});
console.log(JSON.stringify(o),errs);await b.close();})();
