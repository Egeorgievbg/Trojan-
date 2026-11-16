import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, devices, webkit } from 'playwright';
import { isolatedEvent } from './fixture.mjs';

const contentTypes = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', jpg: 'image/jpeg', webp: 'image/webp'
};

test('respond, resume, edit, organize and check layout in a real browser', { timeout: 130000 }, async t => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const { pg, handler, organizer, invitation } = await isolatedEvent(origin);
  t.after(() => pg.close());
  const mainInvite = await invitation('household-a');
  const url = origin + '/#invite=household-a.' + mainInvite;
  server.on('request', async (req, res) => {
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith('/api/')) {
      const parts = [];
      for await (const chunk of req) parts.push(chunk);
      let body;
      try { body = parts.length ? JSON.parse(Buffer.concat(parts)) : undefined; }
      catch { res.statusCode = 400; res.end(); return; }
      res.status = status => { res.statusCode = status; return res; };
      res.json = value => res.end(JSON.stringify(value));
      res.redirect = (status, location) => { res.status(status).setHeader('Location', location); res.end(); };
      await handler(Object.assign(req, { body, query: Object.fromEntries(url.searchParams) }), res);
      return;
    }
    try {
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      res.setHeader('Content-Type', contentTypes[path.split('.').at(-1)] ?? 'application/octet-stream');
      res.end(await readFile(new URL('../dist' + path, import.meta.url)));
    } catch { res.statusCode = 404; res.end(); }
  });
  const engine = process.env.TROJAN_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
  t.after(() => browser.close());
  const mobile = await browser.newContext({
    ...devices[engine === webkit ? 'iPhone 13' : 'Pixel 7'], viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce'
  });
  const page = await mobile.newPage();
  page.setDefaultTimeout(7500);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 500) errors.push(response.status() + ' ' + new URL(response.url()).pathname); });
  const action = (id, target = page) => target.locator(`[data-action27="${id}"]`);
  const click = (id, target = page) => action(id, target).click();
  const title = (text, target = page) => target.getByRole('heading', { name: text, exact: true }).waitFor();
  const person = name => page.locator('.t27-person-context strong').getByText(name, { exact: true }).waitFor();
  const next = () => click('next');
  const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
  const screenshots = process.env.TROJAN_SCREENSHOTS;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  async function capture(label, target = page) {
    if (screenshots) await target.screenshot({ path: join(screenshots, label + '.png'), animations: 'disabled' });
  }
  async function responsive(screen, target = page, mobileView = true) {
    for (const width of widths) {
      await target.setViewportSize({ width, height: width <= 430 ? 840 : 940 });
      const result = await target.evaluate(() => {
        const root = document.documentElement;
        const narrow = [...document.querySelectorAll('.t27 button:not(:disabled), .t27 summary')]
          .filter(node => {
            const { width, height } = node.getBoundingClientRect();
            return width && height && (width < 43.9 || height < 43.9);
          }).map(node => node.textContent.trim());
        const overflow = root.scrollWidth - root.clientWidth;
        const overflowing = overflow > 1 ? [...document.querySelectorAll('body *')].filter(node =>
          node.getBoundingClientRect().right > root.clientWidth + 1 && getComputedStyle(node).position !== 'absolute')
          .slice(0, 8).map(node => node.tagName + '.' + String(node.className)) : [];
        return { overflow, narrow, overflowing };
      });
      assert.ok(result.overflow <= 1, `${screen} at ${width}px: ${result.overflow}px overflow (${result.overflowing.join(', ')})`);
      if (width <= 430) assert.deepEqual(result.narrow, [], `${screen} has cramped controls at ${width}px`);
    }
    await target.setViewportSize({ width: mobileView ? 390 : 1440, height: mobileView ? 844 : 940 });
    await capture(screen, target);
  }

  let releasePublic;
  const heldPublic = new Promise(resolve => { releasePublic = resolve; });
  await page.route('**/api/public', async route => { await heldPublic; await route.continue(); });
  try {
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('.hero').waitFor();
    assert.equal(await page.locator('#home-counts').textContent(), '');
    assert.equal(await page.locator('.home-hero-copy').evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.ok(await page.getByRole('heading', { name: /Нова година/ }).isVisible());
  } finally {
    releasePublic();
  }
  await page.getByText('4 домакинства · 14 поканени').waitFor();
  await page.unroute('**/api/public');
  assert.doesNotMatch(await page.locator('body').innerText(), /Гост А1|Дете А3/);
  await responsive('01-home');
  const firstPhoto = page.getByRole('button', { name: 'Разгледай: Общ изглед към имота' });
  await firstPhoto.click();
  const gallery = page.getByRole('dialog', { name: 'Галерия на вилата' });
  await gallery.waitFor();
  await page.keyboard.press('ArrowRight');
  await gallery.getByText(/2 \/ 6/).waitFor();
  await page.keyboard.press('Escape');
  await gallery.waitFor({ state: 'hidden' });
  assert.equal(await firstPhoto.evaluate(button => button === document.activeElement), true);
  await page.goto(origin + '/#invite=household-a.bad');
  await page.getByRole('alert').waitFor();
  await page.goto(url);
  await title('Примерно семейство А');
  assert.equal(new URL(page.url()).hash, '#survey');
  await responsive('02-invitation');
  await click('start');
  await title('Кой ще празнува с нас?');
  await next();
  await page.getByRole('alert').waitFor();
  await click('presence:adult-a1:yes');
  await click('meal:adult-a1:31-dinner');
  await click('meal:adult-a1:01-breakfast');
  await click('presence:adult-a2:no');
  await click('presence:child-a3:yes');
  await click('meal:child-a3:31-dinner');
  await responsive('03-attendance');
  await next();
  await title('Хранителни ограничения');
  await person('Гост А1');
  await click('restriction:none');
  await next();
  await person('Дете А3');
  await click('restriction:has');
  await click('kind:allergy');
  await click('allergen:nuts');
  await page.getByLabel('Точен продукт или уточнение').fill('Примерен орех');
  await responsive('04-child');
  await next();
  await title('Меню и напитки');
  await person('Гост А1');
  await click('pick:kyufte');
  await page.locator('[data-group27="drink"] summary').click();
  await click('pick:wine-rose');
  await page.getByLabel('Друго предпочитание (по желание)').fill('<b>Без суров лук</b>');
  await responsive('05-menu');
  await next();
  await person('Дете А3');
  assert.equal(await action('pick:wine-rose').count(), 0);
  assert.equal(await action('pick:rakia-plum').count(), 0);
  await page.locator('[data-group27="drink"] summary').click();
  await click('pick:juice');
  await click('activity:board');
  await click('save-exit');
  await page.locator('.hero').waitFor();
  await page.goto(url);
  await title('Примерно семейство А');
  await click('start');
  await person('Дете А3');
  assert.equal(await action('pick:juice').getAttribute('aria-pressed'), 'true');
  await mobile.setOffline(true);
  await next();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /Връзката прекъсна/);
  await mobile.setOffline(false);
  await next();
  await title('Какво ще подготвим заедно?');
  await click('tradition:fortune-banitsa');
  await click('task:grill');
  await responsive('06-shared-plan');
  await next();
  await title('Готови ли сме?');
  await responsive('07-review');
  assert.equal(await page.locator('.t27-review-card b').count(), 0);
  await next();
  await title('Анкетата е изпратена');
  await page.reload();
  await title('Анкетата е изпратена');
  await click('edit:4');
  await title('Готови ли сме?');
  await click('edit:2:adult-a1');
  await person('Гост А1');
  await click('pick:kebapche');
  await next();
  await title('Готови ли сме?');
  await next();
  await title('Анкетата е изпратена');
  await page.goto(origin + '/#admin');
  await title('Вход за организатора');

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 940 }, reducedMotion: 'reduce' });
  await adminContext.addCookies([{ name: 'troian_admin', value: organizer, url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const admin = await adminContext.newPage();
  admin.setDefaultTimeout(7500);
  admin.on('pageerror', error => errors.push(error.message));
  await admin.goto(origin + '/#admin');
  await title('Организация на празника', admin);
  await click('family:household-a', admin);
  await title('Примерно семейство А', admin);
  await admin.getByText('Примерен орех', { exact: false }).first().waitFor();
  await responsive('08-organizer', admin, false);
  for (const tab of ['questions', 'catalog', 'menu', 'shopping', 'program']) {
    await click('tab:' + tab, admin);
    await responsive('09-' + tab, admin, false);
  }
  await click('tab:menu', admin);
  const menu = admin.locator('form[data-form27="menu"]').last();
  await menu.locator('select[name="recipe"]').selectOption('kyufte');
  await menu.locator('input[name="portions"]').fill('3');
  await menu.locator('button[type="submit"]').click();
  await admin.locator('form[data-form27="menu"][data-id="kyufte"]').waitFor();
  await click('tab:shopping', admin);
  const purchase = admin.locator('form[data-form27="purchase"]').first();
  await purchase.locator('input[name="bought"]').fill('20');
  await purchase.locator('input[name="assigned"]').fill('Примерен отговорник');
  await purchase.locator('button[type="submit"]').click();
  await admin.getByText('Запазено.', { exact: true }).waitFor();
  const download = admin.waitForEvent('download');
  await admin.getByRole('link', { name: 'Изтегли CSV' }).click();
  assert.equal((await download).suggestedFilename(), 'trojan-2027-shopping.csv');
  assert.deepEqual(errors, []);
});
