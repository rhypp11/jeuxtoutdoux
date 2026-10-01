/* Run with Playwright and Chromium available; never logs in or accesses Firebase. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.join(root,pathname === '/' ? 'index.html' : pathname);
  if(!file.startsWith(root + path.sep)){res.writeHead(403).end();return;}
  try{
    let content = fs.readFileSync(file);
    if(file.endsWith('index.html')) content = Buffer.from(content.toString().replace('window.JTD_PREVIEW_MODE =','window.JTD_PREVIEW_MODE = true ||'));
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  }catch(error){res.writeHead(404).end();}
});
const payload = {
  app:'Jeux Tout Doux',version:2,data:{
    games:[{id:'g',nom:'<img src=x onerror="window.INJECTED=1"> & "Persona"',plateforme:'PC',format:'Numérique',collector:true,japanese:true,prix:20,date:'2026-10-01',source:'L\'enseigne <b>test</b>',image:'http://127.0.0.1:1/broken.png'}],
    arrivals:[{id:'a',nom:'Arrivage',plateforme:'PC',collector:true,japanese:true,prix:30,date:'2026-11-10',source:'Test'}],
    wishlist:[{id:'w',nom:'Wishlist <b>test</b>',plateforme:'PC',collector:true,japanese:true,date:'2027',lien:'javascript:alert(1)'}],
    platformMeta:{PC:{color:'#123456',logo:null}},platformOrder:['PC'],profile:{name:'Test',avatar:null}
  }
};
async function restore(page, value, confirm=true){
  await page.locator('#profile-menu-btn').click();
  const event = page.waitForEvent('filechooser');
  await page.locator('#restore-trigger').click();
  const chooser = await event;
  await chooser.setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  if(confirm) await page.locator('#confirm-modal-confirm-btn').click();
  else await page.locator('#confirm-modal-cancel-btn').click();
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = process.env.JTD_TEST_URL || 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true,...(process.env.JTD_CHROME ? {executablePath:process.env.JTD_CHROME} : {})});
  try{
    for(const width of [390,1440]){
      const context = await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,serviceWorkers:'block'});
      const page = await context.newPage();
      const errors=[],firebaseRequests=[];let pickers=0;
      page.on('pageerror',error=>errors.push(error.message));
      page.on('filechooser',()=>pickers++);
      await page.route('**/*',route=>{
        const target=route.request().url();
        if(/gstatic\.com\/firebase|firestore\.googleapis|identitytoolkit|securetoken/.test(target)){firebaseRequests.push(target);return route.abort();}
        if(/fonts\.googleapis|fonts\.gstatic/.test(target))return route.abort();
        return route.continue();
      });
      await page.goto(url);
      await page.locator('#app-shell').waitFor({state:'visible'});
      await restore(page,payload);
      await page.waitForTimeout(200);
      assert.equal(pickers,1,'restore must not reopen the file picker');
      assert.equal(await page.evaluate(()=>window.INJECTED),undefined);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games[0].nom),payload.data.games[0].nom);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.wishlist[0].lien),null);
      await page.locator('.nav-tab[data-page="collection"]').click();
      assert.equal(await page.locator('.card-name-text').innerText(),payload.data.games[0].nom);
      assert.equal(await page.locator('.card-source').innerText(),payload.data.games[0].source);
      assert.equal(await page.locator('.card img[onerror]').count(),0);
      assert.equal(await page.locator('.card-name-text img').count(),0);
      await page.locator('.card-status-badge').click();
      await page.locator('.card-status-option[data-status="termine"]').click();
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games[0].status),'termine');
      await restore(page,{games:[]},false);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games.length),1);
      // Selecting the same filename again still works through the native label.
      await restore(page,payload);
      assert.equal(pickers,3);
      await page.evaluate(()=>{renamePlatform('PC','Ordinateur "test"');buildPlatformList();render();});
      assert.ok(await page.evaluate(()=>[GAMES,ARRIVALS,WISHLIST].every(list=>list.every(item=>item.plateforme==='Ordinateur "test"'))));
      await page.locator('.card').click();
      await page.locator('#cancel-btn').click();
      const downloadEvent=page.waitForEvent('download');
      await page.locator('#profile-menu-btn').click();await page.locator('#backup-btn').click();
      const download=await downloadEvent;
      const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.equal(saved.data.games[0].japanese,true);assert.equal(saved.data.arrivals[0].prix,30);
      await page.locator('#profile-menu-btn').click();
      const invalidEvent=page.waitForEvent('filechooser');await page.locator('#restore-trigger').click();
      await (await invalidEvent).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"games":[],"wishlist":"invalid"}')});
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>buildBackupPayload().data.games.length),1);
      assert.equal(await page.locator('#confirm-modal-overlay').isVisible(),false);
      assert.equal(firebaseRequests.length,0,'sandbox must not load production Firebase');
      assert.deepEqual(errors,[]);
      await page.screenshot({path:'/tmp/jtd-step1-'+width+'.png',fullPage:true});
      console.log('PASS browser '+width+'px: restore/cancel/same file, escaping, status, rename, backup, invalid backup, no Firebase');
      await context.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
