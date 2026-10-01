const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = process.env.JTD_QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'jtd-qa-'));
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, content) => {
    if (error) return res.writeHead(404).end();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/json', 'Cache-Control': 'no-store' });
    res.end(content);
  });
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  try {
    for (const device of [
      { name: 'desktop', viewport: { width: 1440, height: 1000 } },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      { name: 'mobile-small', viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }
    ]) {
      const context = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch, locale: 'fr-FR' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [], firebaseRequests = [];
      let chooserCount = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('filechooser', () => chooserCount++);
      await context.route('**/*', route => {
        const url = route.request().url();
        if (/firebase|firestore|identitytoolkit|securetoken/.test(url)) firebaseRequests.push(url);
        if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.addInitScript(() => {
        if (!localStorage.getItem('ludotheque:games-v2')) localStorage.setItem('ludotheque:games-v2', 'PRODUCTION_SENTINEL');
      });
      const click = selector => page.locator(selector).click();
      const snapshot = () => page.evaluate(() => buildBackupPayload().data);
      async function layout(label) {
        const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(geometry.scroll <= geometry.width + 1, label + ': débordement horizontal');
      }
      async function selectPlatform(prefix, name) {
        const wrap = page.locator('#' + prefix + '-plateforme').locator('..');
        await wrap.locator('.icon-select-trigger').click();
        await wrap.locator('.icon-select-option').filter({ hasText: name }).click();
      }
      async function openRestore(data) {
        const file = path.join(output, 'restore-' + device.name + '.json');
        fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
        await click('#profile-menu-btn');
        const chosen = page.waitForEvent('filechooser');
        await click('#restore-trigger');
        await (await chosen).setFiles(file);
        await delay(100);
        assert.equal(await page.locator('#profile-menu').isVisible(), false);
      }
      async function homeBoard(target) {
        await click('[data-page="home"]');
        if (device.isMobile) await click('.home-boards-switch-btn[data-target="' + target + '"]');
      }
      await page.goto(origin);
      await page.locator('#app-shell').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => window.JTD_PREVIEW_MODE), true);
      await layout('Accueil');
      await page.screenshot({ path: path.join(output, device.name + '-home.png'), fullPage: true });
      if (device.isMobile) {
        await click('#global-filter-toggle');
        assert.equal(await page.locator('#home-sidebar').evaluate(el => el.classList.contains('mobile-open')), true);
        await click('#mobile-backdrop');
      }

      await click('[data-page="collection"]');
      await click('#add-btn');
      await page.locator('#f-nom').fill('Jeu QA');
      await selectPlatform('f', 'Switch 2');
      await page.locator('#f-prix').fill('12,34');
      await page.locator('#f-date').fill('2026-09-17');
      await page.locator('#f-source').fill('Test');
      await page.locator('#f-collector').check();
      await page.locator('#f-japanese').check();
      await layout('Ajout collection');
      await click('#save-btn');
      let card = page.locator('.card').filter({ hasText: 'Jeu QA' });
      assert.equal(await card.count(), 1);
      assert.match(await card.innerText(), /12,34/);
      await card.locator('.card-status-badge').click();
      await card.locator('[data-status="termine"]').click();
      assert.equal((await snapshot()).games.find(g => g.nom === 'Jeu QA').status, 'termine');
      await card.click();
      await click('#f-identity-summary .identity-edit-btn');
      await page.locator('#f-nom').fill('Jeu QA modifié');
      await click('#save-btn');
      card = page.locator('.card').filter({ hasText: 'Jeu QA modifié' });
      await card.click();
      await click('#delete-btn');
      await click('#confirm-modal-cancel-btn');
      await click('#delete-btn');
      await click('#confirm-modal-confirm-btn');
      assert.equal(await page.locator('.card').filter({ hasText: 'Jeu QA modifié' }).count(), 0);
      await click('.toast-action');
      assert.equal(await page.locator('.card').filter({ hasText: 'Jeu QA modifié' }).count(), 1);
      await page.locator('#search-input').fill('Aucun résultat QA');
      assert.equal(await page.locator('.empty-state').count(), 1);
      await page.locator('#search-input').fill('');
      await layout('Collection');
      await page.screenshot({ path: path.join(output, device.name + '-collection.png'), fullPage: true });

      await homeBoard('wishlist');
      await click('#add-wishlist-btn');
      await page.locator('#w-nom').fill('Wishlist QA');
      await selectPlatform('w', 'Switch 2');
      await page.locator('#w-date').fill('2099-11-05');
      await click('#w-save-btn');
      const wish = page.locator('#wishlist-rows .board-row').filter({ hasText: 'Wishlist QA' });
      await wish.click();
      await click('#w-to-arrival-btn');
      assert.equal(await page.locator('#a-to-collection-btn').isVisible(), false);
      assert.equal(await page.locator('#a-to-wishlist-btn').isVisible(), false);
      await click('#a-cancel-btn');
      assert.equal((await snapshot()).wishlist.some(w => w.nom === 'Wishlist QA'), true);
      await wish.click();
      await click('#w-to-arrival-btn');
      await page.locator('#a-date').fill('2099-11-12');
      await page.locator('#a-prix').fill('49,99');
      await page.locator('#a-source').fill('Boutique QA');
      await layout('Conversion arrivage');
      await click('#a-save-btn');
      assert.equal((await snapshot()).wishlist.some(w => w.nom === 'Wishlist QA'), false);
      await homeBoard('arrivals');
      const arrival = page.locator('#arrivals-rows .board-row').filter({ hasText: 'Wishlist QA' });
      await arrival.click();
      await click('#a-to-wishlist-btn');
      await click('#w-cancel-btn');
      assert.equal((await snapshot()).arrivals.some(w => w.nom === 'Wishlist QA'), true);
      await arrival.click();
      await click('#a-to-collection-btn');
      await click('#cancel-btn');
      assert.equal((await snapshot()).arrivals.some(w => w.nom === 'Wishlist QA'), true);
      await arrival.click();
      await click('#a-to-collection-btn');
      await layout('Réception dans la collection');
      await click('#save-btn');
      const converted = (await snapshot()).games.find(g => g.nom === 'Wishlist QA');
      assert.equal(converted.prix, 49.99);
      assert.equal(converted.source, 'Boutique QA');
      assert.equal((await snapshot()).arrivals.some(w => w.nom === 'Wishlist QA'), false);

      await click('#profile-menu-btn');
      await page.locator('#profile-name-input').fill('Profil QA');
      await page.locator('#profile-name-input').press('Tab');
      const downloaded = page.waitForEvent('download');
      await click('#backup-btn');
      const backup = JSON.parse(fs.readFileSync(await (await downloaded).path(), 'utf8'));
      assert.equal(backup.data.profile.name, 'Profil QA');
      const before = await snapshot();
      await openRestore(backup);
      await page.locator('#confirm-modal-overlay').waitFor({ state: 'visible' });
      await layout('Confirmation restauration');
      await page.screenshot({ path: path.join(output, device.name + '-restore.png') });
      await click('#confirm-modal-cancel-btn');
      assert.deepEqual(await snapshot(), before);
      await openRestore(backup);
      await page.locator('#confirm-modal-cancel-btn').press('Escape');
      assert.equal(await page.locator('#confirm-modal-overlay').isVisible(), false);
      assert.deepEqual(await snapshot(), before);
      await click('[data-page="collection"]');
      await page.locator('#search-input').fill('Filtre périmé');
      await openRestore(backup);
      await click('#confirm-modal-confirm-btn');
      assert.equal(await page.locator('#search-input').inputValue(), '');
      assert.deepEqual(await snapshot(), before);
      assert.equal(chooserCount, 3);
      await delay(200);
      assert.equal(chooserCount, 3, 'Le sélecteur ne doit pas se rouvrir après restauration');
      await page.reload();
      await page.locator('#app-shell').waitFor({ state: 'visible' });
      assert.deepEqual(await snapshot(), before);
      assert.equal(await page.evaluate(() => localStorage.getItem('ludotheque:games-v2')), 'PRODUCTION_SENTINEL');

      for (const invalid of ['{invalid', { app: 'Jeux Tout Doux', version: 999, data: before },
        { games: [{ nom: 'Corrompu', plateforme: 'Switch 2', date: 42 }] }, { ...before, wishlist: {} }]) {
        await openRestore(invalid);
        assert.equal(await page.locator('#confirm-modal-overlay').isVisible(), false);
        assert.deepEqual(await snapshot(), before);
      }
      const fixture = { app: 'Jeux Tout Doux', version: 2, data: {
        games: [{ nom: 'Ancien export', plateforme: 'Switch 2', format: 'Physique' }, { id: 'duplicate', nom: 'Deux', plateforme: 'Switch 2' }, { id: 'duplicate', nom: 'Trois', plateforme: 'PC' }],
        arrivals: [], wishlist: [
          { nom: 'A du 12', plateforme: 'PC', date: '2099-11-12' }, { nom: 'Z du 5', plateforme: 'PC', date: '2099-11-05' },
          { nom: 'Année 2099', plateforme: 'PC', date: '2099' }, { nom: 'Année 2100', plateforme: 'PC', date: '2100' },
          { nom: 'TBD', plateforme: 'PC', date: 'TBD' }, { nom: 'Sorti', plateforme: 'PC', date: '2000-01-02' }
        ], platformOrder: [], platformMeta: {} }
      };
      await openRestore(fixture);
      await click('#confirm-modal-confirm-btn');
      const restored = await snapshot();
      assert.equal(new Set(restored.games.map(g => g.id)).size, 3);
      assert.equal(new Set(restored.wishlist.map(g => g.id)).size, 6);
      await homeBoard('wishlist');
      const names = await page.locator('#wishlist-rows .board-name').allTextContents();
      assert.deepEqual(names.map(s => s.trim()), ['Z du 5', 'A du 12', 'Année 2099', 'Année 2100', 'TBD', 'Sorti']);
      assert.equal(await page.locator('.calendar-group-released .calendar-day').count(), 0);
      assert.match(await page.locator('.wishlist-release-date').innerText(), /02\/01\/2000/);
      if (device.isMobile) {
        const row = page.locator('#wishlist-rows .board-row').filter({ hasText: 'Z du 5' });
        const dateBox = await row.locator('.calendar-day').boundingBox();
        const imageBox = await row.locator('.board-thumb').boundingBox();
        assert.ok(dateBox && imageBox && dateBox.x + dateBox.width <= imageBox.x + 1, 'Date avant la vignette');
      }
      await layout('Wishlist restaurée');
      await page.screenshot({ path: path.join(output, device.name + '-wishlist-restored.png'), fullPage: true });
      await openRestore([]);
      await click('#confirm-modal-confirm-btn');
      assert.equal(await page.locator('#home-total-games').innerText(), '0');
      assert.deepEqual((await snapshot()).games, []);
      assert.deepEqual(errors, []);
      assert.deepEqual(firebaseRequests, [], 'Aucune requête Firebase, Auth ou Firestore autorisée pendant les tests');
      results.push({ device: device.name, passed: true, restoreChooserEvents: chooserCount, firebaseRequests: 0 });
      console.log('PASS ' + device.name + ': collection, statuts, suppression/annulation, wishlist, arrivages, sauvegarde/restauration, persistance et isolation');
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
