/**
 * Every component that renders a heading takes `headingLevel`, keeps its historical level as the
 * default, and moves nested headings with it.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { Card } from './Card.tsx';
import { DetailPanel } from './DetailPanel.tsx';
import { Dialog } from './Dialog.tsx';
import { EmptyState } from './EmptyState.tsx';
import { FacetRail } from './FacetRail.tsx';
import { MapExplorer } from './MapExplorer.tsx';
import { ResultList } from './ResultList.tsx';
import { Timeline } from './Timeline.tsx';
import { subheadingLevel } from '../utils/heading.ts';

const headings = (html: string) => [...html.matchAll(/<(h[1-6])\b/g)].map((match) => match[1]);

const cases = [
  {
    name: 'EmptyState',
    fallback: ['h2'],
    render: (headingLevel?: 2 | 4) =>
      createElement(EmptyState, { title: 'No results', headingLevel }, 'Adjust filters.'),
  },
  {
    name: 'Card',
    fallback: ['h3'],
    render: (headingLevel?: 2 | 4) => createElement(Card, { title: 'Place', headingLevel }, 'Body'),
  },
  {
    name: 'Timeline',
    fallback: ['h3'],
    render: (headingLevel?: 2 | 4) =>
      createElement(Timeline, {
        items: [{ id: 'a', time: '1921', title: 'Event' }],
        headingLevel,
      }),
  },
  {
    name: 'ResultList',
    fallback: ['h3'],
    render: (headingLevel?: 2 | 4) =>
      createElement(ResultList, {
        items: [{ id: 'a', href: '/a', title: 'Result', summary: 'Summary' }],
        headingLevel,
      }),
  },
  {
    name: 'Dialog',
    fallback: ['h2'],
    render: (headingLevel?: 2 | 4) =>
      createElement(
        Dialog,
        { open: false, title: 'Confirm', onClose: () => {}, headingLevel },
        'Body',
      ),
  },
  {
    name: 'DetailPanel',
    fallback: ['h2'],
    render: (headingLevel?: 2 | 4) =>
      createElement(DetailPanel, { title: 'Record', headingLevel }, null),
  },
  {
    name: 'FacetRail',
    fallback: ['h2', 'h3'],
    render: (headingLevel?: 2 | 4) =>
      createElement(FacetRail, {
        groups: [
          {
            id: 'kind',
            label: 'Kind',
            options: [
              { value: 'place', label: 'Place', count: 3, href: '?kind=place', active: false },
            ],
          },
        ],
        headingLevel,
      }),
  },
  {
    name: 'MapExplorer',
    fallback: ['h3', 'h4'],
    render: (headingLevel?: 2 | 4) =>
      createElement(MapExplorer, {
        title: 'Places',
        features: [],
        stateAggregates: [{ stateName: 'Georgia', statePostalCode: 'GA', count: 2 }],
        headingLevel,
      }),
  },
];

for (const { name, fallback, render } of cases) {
  test(`${name} keeps its default heading levels`, () => {
    assert.deepEqual(headings(renderToStaticMarkup(render())), fallback);
  });

  test(`${name} renders its headings at the level the caller asks for`, () => {
    const expected = fallback.length === 1 ? ['h4'] : ['h4', 'h5'];
    assert.deepEqual(headings(renderToStaticMarkup(render(4))), expected);
  });
}

test('nested headings stop at h6', () => {
  assert.equal(subheadingLevel(5), 6);
  assert.equal(subheadingLevel(6), 6);
});
