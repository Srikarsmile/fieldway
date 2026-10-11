import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const tabletStyles = styles.slice(styles.indexOf('@media (max-width: 768px)'));
const phoneStyles = styles.slice(styles.indexOf('@media (max-width: 480px)'));

test('mobile programme card titles receive a full row', () => {
  assert.match(
    phoneStyles,
    /\.programme-detail__header\s*\{[\s\S]*grid-template-areas:\s*"icon number"\s*"title title"/,
  );
  assert.match(phoneStyles, /\.programme-detail__number\s*\{[\s\S]*position:\s*static/);
  assert.match(phoneStyles, /\.programme-detail__title\s*\{[\s\S]*overflow-wrap:\s*normal/);
});

test('small contact cards can shrink and wrap long email addresses', () => {
  assert.match(tabletStyles, /\.contact-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.contact-item\s*>\s*:last-child\s*\{[\s\S]*min-width:\s*0/);
  assert.match(styles, /\.contact-item a\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
});

test('mobile controls and tablet galleries keep useful structure', () => {
  assert.match(tabletStyles, /\.programme-jump__link,[\s\S]*\.filter-pill,[\s\S]*\.footer__col a\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(styles, /@media \(min-width: 600px\) and \(max-width: 768px\)\s*\{[\s\S]*\.gallery-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});
