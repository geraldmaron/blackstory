/**
 * The terms notice actually renders, and the parts a reader comes looking for are in the markup
 * rather than only in the source. `terms-page.test.ts` reads the file; this renders it, so a
 * section that is written but never mounted (a stray branch, a section dropped from the tree)
 * fails here instead of shipping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import { CORRECTION_PRIVACY_NOTICE } from '../corrections/copy';
import { TermsSections } from './TermsSections';

void React;

const HTML = renderToStaticMarkup(<TermsSections />);

/**
 * Rendered body text, with tags dropped and every apostrophe spelling flattened to one. React
 * emits `&#x27;` for a straight quote and passes a typographic one through untouched, so a
 * comparison against either spelling fails on the other for no reason a reader would care about.
 */
function readerText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&apos;|[‘’]/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const TEXT = readerText(HTML);

test('every section in the on-page nav is a section that rendered', () => {
  for (const id of [
    'scope',
    'what-this-is',
    'using',
    'reuse',
    'submissions',
    'about-you',
    'copyright',
    'accuracy',
    'liability',
    'affiliate',
    'changes',
  ]) {
    assert.ok(HTML.includes(`id="${id}"`), `no section rendered for the nav entry #${id}`);
    assert.ok(HTML.includes(`href="#${id}"`), `#${id} rendered but is not in the on-page nav`);
  }
});

test('the license deed link is a real, working href a reader can follow', () => {
  assert.ok(
    HTML.includes('href="https://creativecommons.org/licenses/by/4.0/"'),
    'the CC BY 4.0 deed is named but not linked',
  );
  assert.ok(TEXT.includes('Creative Commons Attribution 4.0 International (CC BY 4.0)'));
});

test('the published contact renders from the shared config, not a literal', () => {
  assert.ok(HTML.includes(`mailto:${SUPPORT_CONTACT}`));
  assert.ok(TEXT.includes(SUPPORT_CONTACT));
});

test('the corrections notice renders word for word, not paraphrased', () => {
  const quoted = readerText(CORRECTION_PRIVACY_NOTICE.body);
  assert.ok(TEXT.includes(quoted), 'the corrections privacy notice was not quoted verbatim');
});

test('the third-party carve-out reaches the reader as body text', () => {
  assert.ok(TEXT.includes("The license does not reach material that is not BlackStory's"));
  for (const source of [
    'Wikimedia Commons',
    'Open Library',
    'the Internet Archive',
    'USGS National Map imagery',
    'OpenStreetMap by way of OpenMapTiles',
  ]) {
    assert.ok(TEXT.includes(source), `${source} is not named in the rendered carve-out`);
  }
});

test('the copyright window renders as 72 hours and 30 days', () => {
  assert.ok(TEXT.includes('within 72 hours'));
  assert.ok(TEXT.includes('within 30 days'));
  assert.ok(TEXT.includes('Material found to be infringing is removed'));
});

test('the record-about-you section renders ahead of the copyright section', () => {
  assert.ok(HTML.indexOf('id="about-you"') < HTML.indexOf('id="copyright"'));
  assert.ok(TEXT.includes('If a record about you is wrong'));
});

test('the rendered page carries no clause that needs a reader to have agreed', () => {
  for (const pattern of [
    /\barbitrat/i,
    /\bindemnif/i,
    /governing law|exclusive jurisdiction|forum selection/i,
    /\bEULA\b/i,
    /\b(?:we|our|us)\b/i,
  ]) {
    assert.doesNotMatch(TEXT, pattern, `the rendered page says something matching ${pattern}`);
  }
});
