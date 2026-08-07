/**
 * Unit coverage for the theme-spine EraTimeline moment: renders fixture events as a vertical
 * chronological rail in both themes, summarizes the date span + event count in `aria-label`,
 * highlights the current era band, names the elapsed years between distant documents, and
 * renders dates at the precision the packet actually stores.
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
  it('renders one rail row per event, in date order', () => {
    const html = renderToStaticMarkup(<EraTimeline events={events} />);
    assert.match(html, /ds-era-timeline__list/);
    const dateMatches = [...html.matchAll(/ds-era-timeline__date-label[^>]*>([^<]+)</g)].map(
      (match) => match[1],
    );
    assert.deepEqual(dateMatches, ['1934', '1937', '1968']);
  });

  it('renders each date at the precision the packet stores, never inventing one', () => {
    const html = renderToStaticMarkup(
      <EraTimeline
        events={[
          { label: 'Year only', date: '1937' },
          { label: 'Year and month', date: '1938-02' },
          { label: 'Full date', date: '1948-05-03' },
        ]}
      />,
    );
    const dateMatches = [...html.matchAll(/ds-era-timeline__date-label[^>]*>([^<]+)</g)].map(
      (match) => match[1],
    );
    assert.deepEqual(dateMatches, ['1937', 'February 1938', 'May 3, 1948']);
  });

  it('names the elapsed years between distant documents, and stays quiet between close ones', () => {
    const html = renderToStaticMarkup(
      <EraTimeline
        events={[
          { label: 'First', date: '1911' },
          { label: 'Close behind', date: '1913' },
          { label: 'Long after', date: '1968' },
        ]}
      />,
    );
    assert.match(html, /55 years later/);
    assert.doesNotMatch(html, /2 years later/);
  });

  it('marks up the rail as an ordered list of times, for assistive technology', () => {
    const html = renderToStaticMarkup(<EraTimeline events={events} />);
    assert.match(html, /<ol/);
    assert.match(html, /<time[^>]*datetime="1934"/i);
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

  it('lays out vertically, so nothing needs horizontal scrolling at any width', () => {
    const html = renderToStaticMarkup(<EraTimeline events={events} />);
    assert.doesNotMatch(html, /scroller/);
    assert.doesNotMatch(html, /<svg/);
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
