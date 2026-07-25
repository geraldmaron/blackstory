/**
 * Unit coverage for the theme-spine EraTimeline moment: renders from fixture events in both
 * themes, summarizes the date span + event count in `aria-label`, highlights the current era
 * band, and scrolls horizontally in its own `overflow-x: auto` container (never the page).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EraTimeline } from './EraTimeline';

void React;

const events = [
  { label: 'HOLC map drawn', date: '1937' },
  { label: 'FHA underwriting manual', date: '1934' },
  { label: 'Fair Housing Act', date: '1968' },
];

const policyEras = [
  { id: 'holc_fha', label: 'HOLC / FHA era', span: '1933–1968' },
  { id: 'fair_housing', label: 'Fair Housing era', span: '1968–1977' },
];

describe('EraTimeline', () => {
  it('renders a hairline axis with a tick + label per event, sorted by date', () => {
    const html = renderToStaticMarkup(<EraTimeline events={events} />);
    assert.match(html, /ds-era-timeline__axis/);
    const dateMatches = [...html.matchAll(/ds-era-timeline__date-label[^>]*>([^<]+)</g)].map(
      (match) => match[1],
    );
    assert.deepEqual(dateMatches, ['1934', '1937', '1968']);
  });

  it('summarizes the date span and event count in aria-label', () => {
    const html = renderToStaticMarkup(<EraTimeline events={events} />);
    assert.match(html, /aria-label="Timeline: 3 events, 1934 to 1968"/);
  });

  it('renders the current chapter era band with a caption when currentEraId matches', () => {
    const html = renderToStaticMarkup(
      <EraTimeline events={events} policyEras={policyEras} currentEraId="holc_fha" />,
    );
    assert.match(html, /ds-era-timeline__era-band/);
    assert.match(html, /HOLC \/ FHA era \(1933–1968\)/);
  });

  it('omits the era band when currentEraId has no match', () => {
    const html = renderToStaticMarkup(
      <EraTimeline events={events} policyEras={policyEras} currentEraId="unknown_era" />,
    );
    assert.doesNotMatch(html, /ds-era-timeline__era-band/);
  });

  it('renders nothing when there are no events', () => {
    const html = renderToStaticMarkup(<EraTimeline events={[]} />);
    assert.equal(html, '');
  });

  it('scrolls horizontally in its own container, never the page', () => {
    const html = renderToStaticMarkup(<EraTimeline events={events} />);
    assert.match(html, /class="ds-era-timeline__scroller"/);
  });

  it('renders identically regardless of theme class on an ancestor (both themes safe)', () => {
    const light = renderToStaticMarkup(
      <div data-theme="light">
        <EraTimeline events={events} />
      </div>,
    );
    const dark = renderToStaticMarkup(
      <div data-theme="dark">
        <EraTimeline events={events} />
      </div>,
    );
    assert.match(light, /ds-era-timeline/);
    assert.match(dark, /ds-era-timeline/);
  });
});
