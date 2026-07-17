
/**
 * Semantic HTML a11y smoke tests for design-system components via SSR markup.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { Card } from '../components/Card.tsx';
import { Citation } from '../components/Citation.tsx';
import { Confidence } from '../components/Confidence.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { MapFrame } from '../components/MapFrame.tsx';
import { MapExplorer } from '../components/MapExplorer.tsx';
import { Notice } from '../components/Notice.tsx';
import { ResultList } from '../components/ResultList.tsx';
import { Timeline } from '../components/Timeline.tsx';

test('Confidence exposes role=status and non-color mark', () => {
  const html = renderToStaticMarkup(createElement(Confidence, { level: 'high' }));
  assert.match(html, /role="status"/);
  assert.match(html, /High confidence/);
  assert.match(html, /aria-hidden="true"/);
});

test('Notice error uses alert role and visible cue text', () => {
  const html = renderToStaticMarkup(
    createElement(Notice, { tone: 'error', title: 'Failed' }, 'Try again'),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Error/);
  assert.match(html, /Failed/);
});

test('Citation uses aside landmark label', () => {
  const html = renderToStaticMarkup(
    createElement(Citation, { source: 'National Archives', href: 'https://example.com' }),
  );
  assert.match(html, /<aside/);
  assert.match(html, /aria-label="Source"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('Timeline renders ordered list with time elements', () => {
  const html = renderToStaticMarkup(
    createElement(Timeline, {
      items: [{ id: '1', time: '1963', title: 'March', body: 'Event' }],
    }),
  );
  assert.match(html, /<ol/);
  assert.match(html, /<time[^>]*dateTime="1963"/);
});

test('MapFrame provides accessible name including pin labels', () => {
  const html = renderToStaticMarkup(
    createElement(MapFrame, {
      title: 'Neighborhood map',
      pins: [{ id: 'p1', label: 'School site', x: 40, y: 50 }],
    }),
  );
  assert.match(html, /role="img"/);
  assert.match(html, /School site/);
});

test('MapExplorer renders an accessible feature legend independent of the map canvas', () => {
  const html = renderToStaticMarkup(
    createElement(MapExplorer, {
      title: 'National presence map',
      caption: 'Public precision only.',
      features: [
        { id: 'e1', displayName: 'Seed Historical Place', kind: 'place', precision: 'city', statePostalCode: 'DC' },
      ],
      stateAggregates: [{ stateName: 'District of Columbia', statePostalCode: 'DC', count: 1 }],
    }),
  );
  assert.match(html, /Seed Historical Place/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /District of Columbia: 1/);
});

test('MapExplorer summarizes zero-feature state without erroring', () => {
  const html = renderToStaticMarkup(
    createElement(MapExplorer, { title: 'Empty map', features: [] }),
  );
  assert.match(html, /0 locations shown/);
});

test('ResultList links expose headings and summaries', () => {
  const html = renderToStaticMarkup(
    createElement(ResultList, {
      items: [
        {
          id: 'r1',
          href: '/places/1',
          title: 'Freedom School',
          summary: 'A community school.',
        },
      ],
    }),
  );
  assert.match(html, /<ul/);
  assert.match(html, /Freedom School/);
  assert.match(html, /href="\/places\/1"/);
});

test('EmptyState announces via status role', () => {
  const html = renderToStaticMarkup(
    createElement(EmptyState, { title: 'No results' }, 'Adjust filters.'),
  );
  assert.match(html, /role="status"/);
  assert.match(html, /No results/);
});

test('Card renders as article by default', () => {
  const html = renderToStaticMarkup(createElement(Card, { title: 'Place' }, 'Body'));
  assert.match(html, /<article/);
  assert.match(html, /Place/);
});

test('fixture shell markup includes main landmark and h1', () => {
  const html = `
    <main>
      <h1>Design system</h1>
      ${renderToStaticMarkup(createElement(Card, { title: 'Example' }, 'Content'))}
      <img src="/map.png" alt="Map legend schematic" />
    </main>
  `;
  assert.match(html, /<main/);
  assert.match(html, /<h1/);
  assert.match(html, /alt="Map legend schematic"/);
  assert.doesNotMatch(html, /tabindex\s*=\s*["']?[1-9]/i);
});
