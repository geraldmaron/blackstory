/**
 * The exhibit frame, receipt and cite control (docs/ui/DESIGN.md section 7.3).
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { Cite, citationHtml, citationText } from './Cite.js';
import { ExhibitFrame, Receipt } from './Exhibit.js';

const frame = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(
      ExhibitFrame,
      { id: 'rec-1-img', kind: 'photograph', ...props } as never,
      createElement('img', { src: '/x.jpg', alt: 'A white chapel' }),
    ),
  );

test('a full exhibit is an addressable figure named by its label', () => {
  const html = frame({ number: '03', basis: 'date not on record' });
  assert.match(html, /<figure id="rec-1-img"/);
  assert.match(html, /aria-labelledby="rec-1-img-label"/);
  assert.match(
    html,
    /<span>Fig\. 03<\/span><span>Photograph<\/span><span>date not on record<\/span>/,
  );
});

test('the figure number is never the address', () => {
  assert.doesNotMatch(frame({ number: '03' }), /id="(fig-)?0?3"/);
});

test('a compact exhibit has no label and so no dangling aria reference', () => {
  const html = frame({ variant: 'compact', number: '03' });
  assert.doesNotMatch(html, /ds-exhibit__label/);
  assert.doesNotMatch(html, /aria-labelledby/);
});

test('the receipt is a figcaption and is rendered whenever one is given', () => {
  const html = frame({
    variant: 'quiet',
    receipt: createElement(Receipt, { source: 'Nyttend', detail: 'Public domain' }),
  });
  assert.match(html, /ds-exhibit--quiet/);
  assert.match(html, /<figcaption class="ds-exhibit__receipt"><div class="ds-receipt">/);
});

test('a map exhibit puts its object on ink and pins it there in both themes', () => {
  assert.match(
    frame({ kind: 'map', ground: 'ink' }),
    /ds-exhibit__object" data-ground="ink" data-ground-fixed=""/,
  );
  assert.doesNotMatch(frame({}), /data-ground/);
});

test('a receipt links its source when it has an address and not otherwise', () => {
  const linked = renderToStaticMarkup(
    createElement(Receipt, { source: 'National Register', href: 'https://example.com/a' }),
  );
  assert.match(linked, /<a href="https:\/\/example.com\/a" rel="noopener noreferrer">/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(Receipt, { source: 'Ledger' })), /<a /);
});

const PARTS = ['"Roberts & Sons." ', { i: 'Black<Story>' }, ', example.com.'] as const;

test('citation text is plain and citation html escapes and italicizes', () => {
  assert.equal(citationText(PARTS), '"Roberts & Sons." Black<Story>, example.com.');
  assert.equal(
    citationHtml(PARTS),
    '"Roberts &amp; Sons." <i>Black&lt;Story&gt;</i>, example.com.',
  );
});

test('Cite is readable without script and renders nothing when there is nothing to cite', () => {
  const html = renderToStaticMarkup(
    createElement(Cite, { formats: [{ style: 'MLA', parts: PARTS }] }),
  );
  assert.match(html, /<details class="ds-cite"><summary class="ds-cite__toggle">Cite<\/summary>/);
  assert.match(html, /<i>Black&lt;Story&gt;<\/i>/);
  assert.match(html, /Copy MLA/);
  assert.equal(renderToStaticMarkup(createElement(Cite, { formats: [] })), '');
});
