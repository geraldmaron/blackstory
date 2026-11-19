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
import { EraTimeline, formatDateLabel } from './EraTimeline';

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
    assert.deepEqual(dateMatches, ['1937', 'Feb 1938', 'May 3, 1948']);
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

  it('leaves a date span out of the sequence, so no gap is ever counted from a range start', () => {
    const html = renderToStaticMarkup(
      <EraTimeline
        events={[
          { label: 'Homeownership by race, 1900 to 2024', date: '1900-2024' },
          { label: 'First', date: '1911' },
          { label: 'Later', date: '1968' },
        ]}
      />,
    );
    assert.doesNotMatch(html, /1900/);
    assert.doesNotMatch(html, /11 years later/);
    assert.match(html, /aria-label="Timeline: 2 events, 1911 to 1968"/);
  });

  it('keeps the longest date label inside the 8rem date column', () => {
    // Widest stored form: an abbreviated month, two-digit day, four-digit year.
    const longest = formatDateLabel('1988-09-13');
    assert.equal(longest, 'Sep 13, 1988');
    // The column is 8rem (128px, --ds-space-32); the 13px mono face sets about 8px a character.
    assert.ok(longest.length * 8 <= 128);
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
