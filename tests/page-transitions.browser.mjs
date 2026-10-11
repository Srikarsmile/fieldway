import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    const body = await readFile(file);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    if (file.endsWith('.html')) {
      // Reproduce production HTML arriving before its stylesheet links.
      const html = body.toString();
      const split = html.indexOf('<link href="https://fonts.googleapis.com');
      res.write(html.slice(0, split));
      setTimeout(() => res.end(html.slice(split)), 150);
    } else {
      res.end(body);
    }
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener('pagereveal', event => {
      window.transitionResult = event.viewTransition ? 'pending' : 'none';
      if (event.viewTransition) {
        event.viewTransition.ready.then(() => {
          window.transitionResult = 'ready';
          window.transitionAnimations = document.getAnimations()
            .filter(animation => animation.animationName?.includes('view-transition')).length;
        }, error => { window.transitionResult = error.message; });
        event.viewTransition.finished.then(() => { window.transitionFinished = true; });
      } else {
        window.transitionFinished = true;
      }
    });
  });
  const checkTransition = async (expected = 'ready') => {
    await page.waitForFunction(() => window.transitionFinished === true);
    assert.equal(await page.evaluate(() => window.transitionResult), expected, page.url());
    if (expected === 'ready') {
      assert.ok(await page.evaluate(() => window.transitionAnimations > 0), 'cross-fade animations run');
    }
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [source, selector, destination, subject] of [
      ['events.html', '.launch-card__actions .btn--primary', 'contact.html?topic=launch#contact-form', 'launch'],
      ['events.html', '.split-cta__actions .btn--secondary', 'contact.html?topic=idea#contact-form', 'general'],
      ['programmes.html', '#homework-club .btn', 'contact.html?programme=homework-club#contact-form', 'programmes'],
      ['about.html', '.footer__col a[href="./contact.html"]', 'contact.html', ''],
    ]) {
      await page.goto(`${base}/${source}`);
      await page.locator(selector).click();
      await page.waitForURL(`${base}/${destination}`);
      await checkTransition();
      assert.equal(await page.locator('#contact-subject').inputValue(), subject);
      if (destination.includes('#contact-form')) {
        assert.ok(await page.evaluate(() => window.scrollY > 0), 'contact deep link scrolls to the form');
      }
      await page.goBack();
      await checkTransition();
      await page.goForward();
      await checkTransition();
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/events.html`);
  await page.getByRole('link', { name: /Let us know you/ }).click();
  await page.waitForURL('**/contact.html?topic=launch#contact-form');
  await checkTransition('none');
  assert.deepEqual(errors, []);
  console.log('PASS: streamed-page contact transitions, history navigation, enquiry prefilling, and reduced motion.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
