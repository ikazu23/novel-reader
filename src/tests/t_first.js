const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const out={};
for(const synced of [true,false]){
const ctx=await b.newContext();
const remote={app:'novel-reader',library:[{id:'nv_R',title:'R',author:'',episodes:[],updatedAt:'2026-01-01T00:00:00Z'}]};
let up=null;
await ctx.route(/googleapis\.com/,async r=>{const u=new URL(r.request().url());
 if(u.pathname==='/drive/v3/files'&&r.request().method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({files:/novel-reader-data/.test(u.searchParams.get('q')||'')?[{id:'f1',modifiedTime:'t1'}]:[]})});
 if(u.searchParams.get('alt')==='media')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(remote)});
 if(u.pathname.startsWith('/upload/')){up=r.request().postData();return r.fulfill({status:200,contentType:'application/json',body:'{}'});}
 return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(1800);
out[synced?'oldDevice':'newDevice']=await pg.evaluate(async(synced)=>{gdriveIsSignedIn=()=>true;gdriveEnsureToken=async()=>{};collectLibraryImageNames=()=>new Set();
 if(synced)localStorage.setItem(LS_LAST_SYNC,'2026-01-02T00:00:00Z');else localStorage.removeItem(LS_LAST_SYNC);
 await gdriveUploadData();return state.library.map(n=>n.title).join(',');},synced);
out[(synced?'old':'new')+'Uploaded']=/"title":"R"/.test(up||'');out.errs=errs;await ctx.close();}
console.log(out);await b.close();})();
