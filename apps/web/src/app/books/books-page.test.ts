/**
 * Books index and detail page wiring: the cover wall's frame, copy limits and the detail anatomy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BOOKS_INDEX_NOTE } from './books-copy';

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const detailSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');
const browseSectionsSource = readFileSync(join(here, 'BooksBrowseSections.tsx'), 'utf8');
const detailViewSource = readFileSync(join(here, '[slug]', 'BookRecordView.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'books-copy.ts'), 'utf8');

test('books index is the cover wall under a page header, with no edition chrome', () => {
  assert.match(indexSource, /BooksBrowseSections/);
  assert.match(indexSource, /<PageHeader/);
  assert.match(indexSource, /title: 'Banned books'/);
  assert.match(indexSource, /crumb: parentCrumb\('\/books'\)/);
  for (const gone of [
    'RoomStats',
    'OrientationInstrument',
    'DocumentColophon',
    'WalkOffRamp',
    'Notice',
  ]) {
    assert.doesNotMatch(indexSource, new RegExp(gone), `${gone} is back on /books`);
  }
  assert.doesNotMatch(indexSource, /how-it-works|BooksHubSections|EditionAtmosphereMosaic/);
  assert.doesNotMatch(indexSource, /Open the Atlas|ATLAS_INSTRUMENT|\/explore|['"`]\/banned-books/);
});

test('books detail page renders the shared record anatomy with the cover as its media', () => {
  assert.match(detailSource, /BookRecordView/);
  assert.match(detailSource, /buildBooksRelatedItems/);
  assert.match(detailViewSource, /<RecordPage/);
  assert.match(detailViewSource, /BooksCoverArt/);
  for (const src of [detailSource, detailViewSource]) {
    assert.doesNotMatch(src, /EditionAtmosphereMosaic|books-panel-chrome|books-edition\.css/);
    assert.doesNotMatch(src, /BooksAnatomyStrip|WalkOffRamp|ds-books-edition__panel-title/);
  }
});

test('the affiliate link is one quiet action, disclosed directly under it, never copper', () => {
  assert.match(detailViewSource, /Buy on Bookshop \(affiliate\)/);
  assert.match(detailViewSource, /sponsored/);
  // The disclosure travels with the link (RecordPage prints `note` under it), not in the file.
  assert.match(detailViewSource, /note: BOOKS_DETAIL\.affiliateNotice/);
  assert.doesNotMatch(detailViewSource, /label: 'Affiliate link'/);
  assert.doesNotMatch(detailViewSource, /ds-cta--copper|buttonClassName\('primary'/);
});

test('books browse is the register toolbar over a cover wall, not kit rows or a search form', () => {
  assert.match(browseSectionsSource, /<RecordsToolbar/);
  assert.match(browseSectionsSource, /<BooksCoverArt/);
  assert.match(browseSectionsSource, /ds-books-wall/);
  for (const gone of [
    'FindBar',
    'RoomSection',
    'HairlineIndex',
    'BooksRipRow',
    'ds-room-idx',
    'Typeahead',
  ]) {
    assert.doesNotMatch(browseSectionsSource, new RegExp(gone), `${gone} is back on /books`);
  }
});

test('books copy avoids em dashes and states the census limit without an institutional voice', () => {
  for (const source of [
    indexSource,
    detailSource,
    detailViewSource,
    browseSectionsSource,
    copySource,
  ]) {
    assert.doesNotMatch(source, /—/);
    assert.doesNotMatch(source, /\bWe could not\b|\bour side\b/);
  }
  assert.match(BOOKS_INDEX_NOTE, /not a complete national census/);
  assert.match(BOOKS_INDEX_NOTE, /not a claim that the book left every school/);
  assert.match(browseSectionsSource, /BOOKS_INDEX_NOTE/);
});

test('the When cell is never sharper than the challenge reports', async () => {
  const { challengeWhen } = await import('./[slug]/BookRecordView');
  assert.deepEqual(challengeWhen([{ schoolYear: '2022-2023' }, { schoolYear: '2022-2023' }]), {
    label: 'When',
    value: '2022-2023',
    detail: 'Challenge school year',
  });
  assert.deepEqual(challengeWhen([{ schoolYear: '2023-2024' }, { schoolYear: '2021-2022' }]), {
    label: 'When',
    value: '2021 to 2024',
    detail: 'Challenge school years',
  });
  assert.deepEqual(challengeWhen([{ challengeYear: 2023 }]), {
    label: 'When',
    value: '2023',
    detail: 'Challenge year',
  });
  assert.deepEqual(challengeWhen([]), { label: 'When', value: 'Not dated yet' });
});
