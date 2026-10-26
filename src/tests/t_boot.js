const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const f of ['index.html','beta2/index.html','beta/index.html']){const pg=await b.newPage();const e=[];pg.on('pageerror',x=>e.push(x.message));
await pg.goto('http://localhost:8765/'+f);await pg.waitForTimeout(2000);
const ok=await pg.evaluate(()=>typeof koUsesSearch==='function'&&typeof koUseJump==='function');console.log(f,ok,e);await pg.close();}
await b.close();})();
