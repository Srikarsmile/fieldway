import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../programmes.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const hero = page.slice(
  page.indexOf('<section class="page-hero page-hero--image page-hero--programmes'),
  page.indexOf('</section>', page.indexOf('<section class="page-hero page-hero--image page-hero--programmes')) + '</section>'.length,
);

test('Programmes uses the shared image-hero content treatment', () => {
  assert.match(hero, /<div class="container">\s*<p class="page-hero__eyebrow">Programmes<\/p>/);
  assert.doesNotMatch(hero, /page-hero__content/);
  assert.doesNotMatch(styles, /\.page-hero--programmes \.page-hero__content/);
  assert.doesNotMatch(styles, /\.page-hero--image\.page-hero--programmes \.page-hero__(?:eyebrow|title|subtitle)/);
});

test('Programmes retains its jump navigation', () => {
  assert.match(page, /<nav class="programme-jump" aria-label="Jump to a programme">/);
  assert.match(page, /href="#creative-arts"/);
});
