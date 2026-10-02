const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
const server=createSandboxServer();
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for(const width of [320,390,640,820]) for(const theme of ['light','dark']) {
      const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});
      const page=await context.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.locator('#app-shell').waitFor({state:'visible'});
      await page.evaluate(()=>{
        const game=GAMES.find(g=>g.format==='Physique');
        game.nom='Fire Emblem — Une très longue édition collector pour tester la lisibilité du titre';
        game.image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#3c7972"/><path d="M0 180 160 20 320 180" fill="#d5c9a7"/></svg>');
        game.collector=true; game.japanese=true; game.source='Boutique avec un nom très long';
        goToPage('collection','Physique');
      });
      await page.locator('#grid .card-banner img').first().evaluate(img=>img.decode());
      const geometry=await page.locator('#grid .card').evaluateAll(cards=>cards.map(card=>{
        const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        return {card:box(card),banner:box(card.querySelector('.card-banner')),platformFont:parseFloat(getComputedStyle(card.querySelector('.card-platform')).fontSize),parts:[...card.querySelectorAll('.card-body,.card-name,.card-platform,.card-status-badge,.card-acquisition,.card-price')].map(box)};
      }));
      for(const g of geometry){
        assert.ok(g.banner.top>=g.card.top+9 && g.banner.bottom<=g.card.bottom-9,'Thumbnail stays inside padded card');
        assert.ok(Math.abs(g.banner.width/g.banner.height-16/9)<.02,'Horizontal thumbnail keeps its proportions');
        assert.ok(g.platformFont>=12,'Platform remains readable');
        for(const p of g.parts) assert.ok(p.left>=g.card.left && p.right<=g.card.right+.5 && p.top>=g.card.top && p.bottom<=g.card.bottom+.5,'Card information stays inside');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`/tmp/jtd-collection-${width}-${theme}.png`,fullPage:true});
      await page.locator('#grid .card-status-badge').first().click();
      await page.locator('#grid .card-status-menu:not(.hidden)').waitFor({state:'visible'});
      const menu=await page.locator('#grid .card-status-menu:not(.hidden)').boundingBox();
      assert.ok(menu.x>=0 && menu.x+menu.width<=width+.5,'Status menu stays on screen');
      await page.locator('#grid .card-status-option').first().click();
      await page.locator('#grid .card-name').first().click();
      await page.locator('#modal-overlay').waitFor({state:'visible'});
      await page.locator('#cancel-btn').click();
      await context.close();
      console.log(`PASS collection ${width}px ${theme}: image, long title, metadata, status menu and edit`);
    }
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
