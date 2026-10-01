const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light'});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='localhost')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8').replace("location.hostname === 'jtd-preview-rhypp11.web.app'","location.hostname === 'localhost'")});
   return route.continue();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8765/');await page.waitForSelector('#app-shell:not(.hidden)');
  for(const theme of ['light','dark']){
   if(theme==='dark')await page.click('#theme-toggle');
   for(const name of ['home','collection']){
    await page.click(`[data-page="${name}"]`);
    await page.screenshot({path:`/tmp/jtd-${width}-${theme}-${name}.png`,fullPage:true});
    const state=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth,body:getComputedStyle(document.body).backgroundColor,button:document.getElementById('theme-toggle').getBoundingClientRect().toJSON(),profile:document.getElementById('profile-menu-btn').getBoundingClientRect().toJSON(),brand:document.querySelector('.brand-word').getBoundingClientRect().toJSON()}));
    if(state.overflow||state.theme!==theme||state.brand.right>state.button.x||state.profile.right>width)throw Error(JSON.stringify({width,name,state}));
   }
   await page.click('#add-btn');await page.waitForSelector('#modal-overlay:not(.hidden)');await page.screenshot({path:`/tmp/jtd-${width}-${theme}-modal.png`,fullPage:true});await page.click('#cancel-btn');
   await page.click('#profile-menu-btn');await page.waitForSelector('#profile-menu:not(.hidden)');await page.click('#profile-menu-btn');
  }
  await page.reload();await page.waitForSelector('#app-shell:not(.hidden)');
  if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')throw Error('Theme persistence');
  results.push({width,errors,persistence:true});await context.close();
 }
 const context=await browser.newContext({colorScheme:'dark'});await context.route('**/*', route => { const url = new URL(route.request().url()); if(url.hostname !== 'localhost') return route.abort(); if(url.pathname === '/') return route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8').replace("location.hostname === 'jtd-preview-rhypp11.web.app'","location.hostname === 'localhost'")}); return route.continue(); });const page=await context.newPage();await page.goto('http://localhost:8765/');if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')throw Error('system preference');await page.emulateMedia({colorScheme:'light'});if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='light')throw Error('system update');results.push({systemPreference:true});
 console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
