import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const screenshots = '/tmp/fieldway-ui-polish';
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ics': 'text/calendar' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const file of ['index.html', 'about.html', 'programmes.html', 'events.html', 'get-involved.html', 'contact.html', 'privacy.html']) {
      await page.goto(`${base}/${file}`);
      await page.evaluate(() => document.fonts.ready);
      for (const img of await page.locator('img').all()) {
        if (await img.isVisible()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate(el => el.decode());
        }
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        brokenImages: [...document.images].filter(img => img.complete && !img.naturalWidth).map(img => img.src),
        spills: [...document.querySelectorAll('h1,h2,h3,.btn,.programme-detail__content,.form__input')]
          .filter(el => el.getBoundingClientRect().width && el.scrollWidth > el.clientWidth + 2)
          .map(el => el.className),
      }));
      assert.equal(layout.overflow, false, `${file} overflow at ${width}`);
      assert.deepEqual(layout.brokenImages, [], `${file} broken images`);
      assert.deepEqual(layout.spills, [], `${file} text spills at ${width}`);
      if ([390, 1440].includes(width) && ['index.html', 'programmes.html', 'contact.html'].includes(file)) {
        await page.screenshot({ path: `${screenshots}/${file}-${width}.png`, fullPage: true });
        await page.screenshot({ path: `${screenshots}/${file}-${width}-viewport.png` });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  await page.locator('.nav-toggle').click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'nav-toggle');

  await page.goto(`${base}/programmes.html`);
  assert.equal(await page.locator('.programme-more').count(), 7);
  assert.equal(await page.locator('.programme-more[open]').count(), 0);
  const closedHeight = await page.locator('#homework-club').evaluate(el => el.offsetHeight);
  console.log('Mobile programme section height:', closedHeight);
  await page.locator('#homework-club summary').click();
  assert.ok(await page.locator('#homework-club').evaluate(el => el.offsetHeight) > closedHeight);
  await page.locator('#homework-club summary').click();
  await page.locator('#homework-club .btn').click();
  await page.waitForURL('**/contact.html?programme=homework-club#contact-form');
  assert.equal(await page.locator('#contact-subject').inputValue(), 'programmes');
  assert.match(await page.locator('#contact-message').inputValue(), /Homework club/);
  assert.ok(await page.locator('.contact-info-panel').evaluate(el => el.offsetTop) < await page.locator('.contact-form-panel').evaluate(el => el.offsetTop));

  await page.getByRole('button', { name: 'Send message' }).click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'contact-name');
  assert.equal(await page.locator('#contact-name').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#contact-name').getAttribute('aria-describedby'), 'contact-name-error');
  await page.locator('#contact-name').fill('Website preview test');
  await page.locator('#contact-email').fill('preview@example.com');
  // Intercept submissions: tests must never send real enquiries.
  await page.route('**/api/contact', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }));
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.locator('.form__fallback').waitFor();
  assert.match(await page.locator('#contact-message').inputValue(), /Homework club/);
  assert.match(await page.locator('.form__fallback').getAttribute('href'), /^mailto:/);
  assert.equal(await page.locator('.form__success').getAttribute('role'), 'status');
  await page.unroute('**/api/contact');
  await page.route('**/api/contact', route => route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByRole('status').filter({ hasText: 'Your message has been sent' }).waitFor();
  assert.equal(await page.locator('#contact-name').inputValue(), '');
  assert.equal(await page.locator('form').getAttribute('aria-busy'), 'false');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/programmes.html`);
  await page.evaluate(() => {
    const original = window.scrollTo;
    window.scrollTo = options => { window.lastScrollBehavior = options.behavior; original(options); };
  });
  await page.locator('a[href="#womens-group"]').click();
  assert.equal(await page.evaluate(() => window.lastScrollBehavior), 'instant');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'womens-group');
  await page.goto(`${base}/events.html`);
  assert.equal(await page.locator('a[href$="fieldway-launch-2026.ics"]').count(), 1);
  await page.getByRole('link', { name: /Let us know you/ }).click();
  await page.waitForURL('**/contact.html?topic=launch#contact-form');
  assert.equal(await page.locator('#contact-subject').inputValue(), 'launch');
  assert.match(await page.locator('#contact-message').inputValue(), /launch/);

  await page.locator('.nav-toggle').click();
  assert.equal(await page.locator('.nav__link--cta').isVisible(), true);
  const menu = await page.locator('.nav').boundingBox();
  assert.ok(menu.width >= 390 - 2 * 16 - 1, `mobile menu spans the header (${menu.width}px)`);
  assert.deepEqual(failures, []);
  console.log('PASS: 28 responsive page checks; keyboard navigation, programme details, enquiry context, validation, mocked failure/success, reduced motion, launch RSVP and mobile menu.');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
