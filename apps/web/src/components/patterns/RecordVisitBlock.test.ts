/**
 * Visit block markup: address/phone icons and contact rows when claims resolve.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { RecordVisitBlock } from './RecordVisitBlock.js';

describe('RecordVisitBlock', () => {
  it('renders the public address with a standard address icon', () => {
    const html = renderToStaticMarkup(
      createElement(RecordVisitBlock, {
        displayName: 'Example Museum',
        locationLabel: '100 Museum Drive, Washington, D.C.',
        jurisdictionLabel: 'Washington, D.C.',
        locationPrecision: 'institution',
        kind: 'institution',
        status: 'active',
        lat: 38.89,
        lng: -77.02,
        compact: true,
      }),
    );

    assert.match(html, /ds-record-visit__address/);
    assert.match(html, /ds-record-visit__icon/);
    assert.match(html, /100 Museum Drive, Washington, D\.C\./);
    assert.match(html, /ds-record-visit__link/);
    assert.match(html, /Open in maps/);
    assert.match(html, /Get directions/);
    assert.doesNotMatch(html, /ds-cta/);
  });

  it('keeps address as compact supporting copy, not a hero headline class', () => {
    const html = renderToStaticMarkup(
      createElement(RecordVisitBlock, {
        displayName: 'Example Museum',
        locationLabel: '100 Museum Drive, Washington, D.C.',
        jurisdictionLabel: 'Washington, D.C.',
        locationPrecision: 'institution',
        kind: 'institution',
        status: 'active',
        lat: 38.89,
        lng: -77.02,
        compact: true,
      }),
    );

    assert.match(html, /ds-record-visit--compact/);
    assert.match(html, /ds-record-visit__address-text/);
    assert.doesNotMatch(html, /ds-cta--copper/);
  });

  it('renders phone and website with icons when visit contact claims resolve', () => {
    const html = renderToStaticMarkup(
      createElement(RecordVisitBlock, {
        displayName: 'Example Museum',
        locationLabel: '100 Museum Drive, Washington, D.C.',
        jurisdictionLabel: 'Washington, D.C.',
        locationPrecision: 'institution',
        kind: 'institution',
        status: 'active',
        claims: [
          {
            id: 'claim-site',
            predicate: 'officialWebsite',
            object: 'https://museum.example.org',
            citationLabel: 'Museum visitor page',
          },
          {
            id: 'claim-phone',
            predicate: 'visitorPhone',
            object: '(202) 555-0100',
            citationLabel: 'Museum visitor page',
          },
        ],
      }),
    );

    assert.match(html, /Visitor information/);
    assert.match(html, /ds-record-visit__visitor-row/);
    assert.match(html, />Phone</);
    assert.match(html, /\(202\) 555-0100/);
    assert.match(html, /href="tel:2025550100"/);
    assert.match(html, /https:\/\/museum\.example\.org/);
    assert.ok((html.match(/ds-record-visit__icon/g) ?? []).length >= 3);
  });

  it('omits visitor contact when precision policy blocks publication', () => {
    const html = renderToStaticMarkup(
      createElement(RecordVisitBlock, {
        displayName: 'Neighborhood Church',
        locationLabel: 'Dupont/Sixteenth Street Historic District area',
        jurisdictionLabel: 'Washington, D.C.',
        locationPrecision: 'neighborhood',
        kind: 'place',
        status: 'active',
        claims: [
          {
            id: 'claim-phone',
            predicate: 'visitorPhone',
            object: '(202) 555-0199',
            citationLabel: 'Directory',
          },
        ],
        compact: true,
      }),
    );

    assert.match(html, /Dupont\/Sixteenth Street Historic District area, Washington, D\.C\./);
    assert.doesNotMatch(html, /Visitor information/);
    assert.doesNotMatch(html, /\(202\) 555-0199/);
  });
});
