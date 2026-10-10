const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createSandboxServer,sandboxContext}=require('./sandbox.cjs');
(async()=>{
 const server=createSandboxServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.JTD_CHROME});
 try{for(const width of [320,390,736,1440])for(const theme of ['light','dark']){
  const context=await sandboxContext(browser,{viewport:{width,height:900},colorScheme:theme});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#journal');await page.locator('#journal-add').waitFor({state:'visible'});
  await page.locator('#journal-add').click();await page.locator('#j-save').click();assert.equal(await page.locator('#j-nom').getAttribute('aria-invalid'),'true');
  assert.ok(await page.locator('#j-details').isVisible());
  const order=await page.evaluate(()=>['j-details','j-status','j-medium','j-completion','j-review'].map(id=>document.getElementById(id).compareDocumentPosition(document.getElementById('j-review'))));
  assert.ok(order.slice(0,4).every(value=>value&4),'Identity and parcours precede the review');
  assert.equal(await page.locator('#j-completion option[value="both"],#j-status option[value="abandoned"]').count(),0);
  const colors=await page.locator('#j-status option').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,scheme:getComputedStyle(el.parentElement).colorScheme}));
  assert.notEqual(colors.background,colors.color);assert.notEqual(colors.background,'rgba(0, 0, 0, 0)');assert.equal(colors.scheme,theme);
  await page.locator('#j-source').selectOption('test-fe');await page.locator('#j-status').selectOption('done');await page.locator('#j-completion').selectOption('achievements');await page.locator('#j-finishedAt').fill(new Date().getFullYear()+'-10-09');await page.locator('#j-feeling').selectOption('love');await page.locator('#j-review').fill('Avis détaillé. '.repeat(250));await page.locator('#j-save').click();
  assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='test-fe').status),'termine');
  await page.evaluate(()=>{goToPage('collection');render();});assert.ok(await page.locator('#page-collection .card-journal-origin').first().isVisible());
  const tag=await page.locator('#page-collection .card-status-badge:has(.card-journal-origin)').first().boundingBox();assert.ok(tag.height<=24&&tag.width<115,'Status stays compact');
  assert.equal(await page.locator('#page-collection .card-journal-origin').first().textContent(),'');
  await page.locator('#page-collection .card-journal-origin').first().click();assert.ok(await page.locator('#journal-modal-overlay').isVisible());await page.locator('#j-cancel').click();await page.evaluate(()=>goToPage('journal'));
  assert.equal(await page.locator('#journal-feed .journal-review-mark').textContent(),'Avis rédigé');assert.ok((await page.locator('#journal-feed').textContent()).length<500);
  await page.reload();await page.locator('#journal-feed [data-journal-id]').first().click();assert.equal((await page.locator('#j-review').inputValue()).length,3749);await page.locator('#j-replay').click();await page.locator('#j-save').click();assert.equal(await page.evaluate(()=>JOURNAL.length),2);assert.equal(await page.evaluate(()=>GAMES.find(g=>g.id==='test-fe').status),'en_cours');
  assert.equal(await page.locator('#journal-playing .journal-result,#journal-backlog .journal-result').count(),0,'Panel headings carry the status once');
  await page.locator('#journal-add').click();await page.locator('#j-kind').selectOption('extension');await page.locator('#j-parentName').fill('Jeu test');await page.locator('#j-nom').fill('Une extension');await page.locator('#j-plateforme').fill('PC');await page.locator('#j-status').selectOption('done');await page.locator('#j-finishedAt').fill(new Date().getFullYear()+'-09-12');await page.locator('#j-save').click();assert.ok((await page.locator('#journal-feed').textContent()).includes('Jeu test — Une extension'));
  if(width<=736){await page.locator('[data-journal-tab="playing"]').click();await page.locator('#journal-playing [data-journal-id]').click();}else await page.locator('#journal-playing [data-journal-id]').click();
  // A failed storage transaction cannot replace memory or close the editor.
  await page.evaluate(()=>{window.originalPersist=window.persistAppData;window.persistAppData=()=>{throw Error('Quota de test');};});await page.locator('#j-status').selectOption('backlog');await page.locator('#j-save').click();assert.equal(await page.evaluate(()=>JOURNAL.find(r=>r.status==='playing')?.status),'playing');assert.equal(await page.locator('#j-error').textContent(),'Quota de test');await page.evaluate(()=>window.persistAppData=window.originalPersist);
  await page.keyboard.press('Escape');assert.ok(await page.locator('#journal-modal-overlay').isHidden());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow '+width);
  if(width<=736)await page.locator('[data-journal-tab="feed"]').click();
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'jtd-journal-'+width+'-'+theme+'.png'),fullPage:true});
  assert.deepEqual(errors,[]);await context.close();console.log('Journal',width,theme,'OK');
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
