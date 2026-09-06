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
    assert.match(html, /maps\.apple\.com\/\?q=100\+Museum\+Drive/);

    // One segmented control per provider: a brand mark, the provider's name, and directions.
    // The old shape was four sibling text links whose labels differed only in a parenthesis.
    assert.match(html, /ds-maps-handoff__provider/);
    assert.match(html, /ds-maps-handoff__name">Apple Maps</);
    assert.match(html, /ds-maps-handoff__name">Google Maps</);
    assert.equal((html.match(/ds-maps-handoff__seg--directions/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Directions \(Apple\)/);
    assert.doesNotMatch(html, /Directions \(Google\)/);
  });

  it('marks each provider with its own logo, and never with the logo alone', () => {
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
      }),
    );

    assert.match(html, /data-icon="apple"/);
    assert.match(html, /data-icon="google"/);
    // WCAG 1.4.1 and the house rule: a mark never travels without the word beside it, and it is
    // hidden from the accessibility tree because the word is already there.
    assert.match(html, /data-icon="apple"[^>]*aria-hidden="true"/);
    assert.match(html, /ds-maps-handoff__name">Apple Maps</);
  });

  it('gives every exit its own accessible name', () => {
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
      }),
    );

    // Four exits used to share one name, "Open <place> in maps", so a screen-reader reader could
    // not tell search from directions or Apple from Google.
    const names = [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
    const exits = names.filter((name) => /Maps$/.test(name ?? ''));
    assert.equal(exits.length, 4);
    assert.equal(new Set(exits).size, 4);
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
    // The maps exits may wear the quiet pill; copper is reserved for the one filled action of a
    // composition, which on these surfaces is the record page's own map CTA, not a handoff.
    assert.match(html, /ds-cta--quiet/);
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
