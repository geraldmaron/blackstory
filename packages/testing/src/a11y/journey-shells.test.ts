/**
 * axe-core over whole pages composed from real `@repo/ui` components.
 *
 * `design-system.test.ts` audits one component at a time, which by construction cannot see the
 * failures that only exist once components sit together: a second `main`, two nodes sharing an
 * `id`, a heading level skipped between a section and the component inside it, content stranded
 * outside every landmark. Those are page facts, and this file is where they are checked.
 *
 * The compositions below are written here rather than imported from `apps/web`: `@repo/testing`
 * is a package and cannot depend on a deployable app (`scripts/validate-boundaries.mjs` enforces
 * that, and `map-search-peers.test.ts` documents the same constraint). So this file is honest
 * about what it is — the SCAFFOLDING (which landmark wraps what, which heading sits where) is
 * written by hand and can drift from the real routes, but every component inside it is the real
 * component rendering its real markup. That is a strictly smaller drift surface than
 * `journey-fixtures.ts`, where the component markup was hand-typed too.
 *
 * What this still cannot see: the actual page components in `apps/web/src/app/**`. A page that
 * assembles these primitives differently from the shells below is not audited by this lane. The
 * only way to close that gap is to run axe from `apps/web`'s own test lane, or from a browser.
 *
 * Read `axe-harness.ts` for the standing limits — no contrast, no layout, no interaction.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card, Citation, Confidence, FacetRail, FilterBar, MapExplorer, MapFrame, Notice, Pagination, ResultList, Timeline } from '@repo/ui';
import { auditRenderedMarkup, describeViolations } from './axe-harness.ts';
import { KNOWN_COMPONENT_FINDINGS, partitionViolations } from './known-findings.ts';

const RESULTS = [
  {
    id: 'ent_1',
    href: '/entity/ent_1',
    title: 'Harlem Cultural Corridor',
    summary: 'A stretch of 125th Street documented from 1926.',
  },
  {
    id: 'ent_2',
    href: '/entity/ent_2',
    title: 'Sweet Auburn Historic District',
    summary: 'Atlanta commercial district documented from 1908.',
  },
];

/** Wraps composed page content in the document chrome a real route ships. */
function page(title: string, body: ReactElement): string {
  const markup = renderToStaticMarkup(body);
  return [
    '<!doctype html>',
    '<html lang="en">',
    `<head><meta charset="utf-8"><title>${title}</title></head>`,
    `<body>${markup}</body>`,
    '</html>',
  ].join('');
}

const RECORDS_INDEX = () =>
  h(
    'main',
    { id: 'main' },
    h(
      'header',
      null,
      h('h1', null, 'Records'),
      h('p', null, 'Every documented record, newest first.'),
    ),
    h(FilterBar, {
      legend: 'Filter documented records',
      method: 'get',
      action: '/records',
      fields: [
        { id: 'q', name: 'q', label: 'Search', type: 'search' },
        {
          id: 'kind',
          name: 'kind',
          label: 'Kind',
          type: 'select',
          options: [
            { value: '', label: 'All' },
            { value: 'place', label: 'Place' },
          ],
        },
      ],
    }),
    h(FacetRail, {
      hasActiveFilters: true,
      clearHref: '/records',
      groups: [
        {
          id: 'era',
          label: 'Era',
          options: [
            { value: '1900s', label: '1900s', count: 412, href: '?era=1900s', active: true },
            { value: '1950s', label: '1950s', count: 1207, href: '?era=1950s', active: false },
          ],
        },
      ],
    }),
    h(
      'section',
      { 'aria-labelledby': 'records-results' },
      h('h2', { id: 'records-results' }, '1,619 records'),
      h(ResultList, { items: RESULTS, labelledBy: 'records-results' }),
      h(Pagination, {
        page: 3,
        pageCount: 40,
        pageSize: 25,
        total: 1000,
        hrefForPage: (value: number) => `/records?page=${value}`,
      }),
    ),
  );

const ENTITY_RECORD = () =>
  h(
    'main',
    { id: 'main' },
    h(
      'header',
      null,
      h('h1', null, 'Harlem Cultural Corridor'),
      h(Confidence, { level: 'high' }),
    ),
    h(Notice, { tone: 'dispute', title: 'Sources disagree on the founding year' }, '1926 or 1927.'),
    h(MapFrame, {
      title: 'Where this is',
      caption: 'Block-level placement.',
      pins: [{ id: 'p1', label: 'Corridor midpoint', x: 40, y: 50 }],
    }),
    h(
      'section',
      { 'aria-labelledby': 'record-story' },
      h('h2', { id: 'record-story' }, 'What happened here'),
      h(Card, { title: 'The corridor', meta: 'Manhattan, New York' }, 'Documented from 1926.'),
      h(Timeline, {
        labelledBy: 'record-story',
        items: [{ id: '1', time: '1926', title: 'First documented lease' }],
      }),
    ),
    h(Citation, {
      source: 'National Register of Historic Places',
      href: 'https://npgallery.nps.gov/NRHP',
    }),
  );

const EXPLORE_MAP = () =>
  h(
    'main',
    { id: 'main' },
    h('header', null, h('h1', null, 'Explore Black history everywhere')),
    h(FilterBar, {
      legend: 'Filter documented records',
      method: 'get',
      action: '/explore',
      fields: [{ id: 'explore-q', name: 'q', label: 'Search', type: 'search' }],
    }),
    // The h2 is load-bearing. MapExplorer hardcodes its legend title at h3 with no headingLevel
    // prop (packages/ui/src/components/MapExplorer.tsx:74), so dropping it straight under the
    // page h1 skips a level and axe reports heading-order. Any page that puts the explorer at the
    // top of its content will hit that; the component needs the prop DetailPanel already has.
    h(
      'section',
      { 'aria-labelledby': 'explore-map' },
      h('h2', { id: 'explore-map' }, 'The map'),
      h(MapExplorer, {
        title: 'Documented places',
        caption: 'The legend beside the map is the accessibility peer, not a fallback.',
        features: [
          {
            id: 'ent_1',
            displayName: 'Harlem Cultural Corridor',
            kind: 'place',
            precision: 'locality',
            statePostalCode: 'NY',
          },
        ],
        stateAggregates: [{ stateName: 'New York', statePostalCode: 'NY', count: 213 }],
      }),
    ),
    h(
      'section',
      { 'aria-labelledby': 'explore-results' },
      h('h2', { id: 'explore-results' }, 'Documented records'),
      h(ResultList, { items: RESULTS, labelledBy: 'explore-results' }),
    ),
  );

const SHELLS: readonly (readonly [string, () => ReactElement])[] = [
  ['records index', RECORDS_INDEX],
  ['entity record', ENTITY_RECORD],
  ['explore map', EXPLORE_MAP],
];

for (const [name, build] of SHELLS) {
  test(`the ${name} shell has no axe violation as a whole page`, async () => {
    // `mode: 'document'` so the page-level rules judge this markup rather than a wrapper:
    // html-has-lang, document-title, landmark-one-main, page-has-heading-one and region all
    // apply here and are the reason this file exists.
    const result = await auditRenderedMarkup(page(name, build()), { mode: 'document' });
    const { unexpected } = partitionViolations(name, result.violations, KNOWN_COMPONENT_FINDINGS);
    assert.ok(
      unexpected.length === 0,
      `the ${name} shell has ${unexpected.length} axe violation(s):\n${describeViolations(unexpected)}`,
    );
  });
}

test('the shell audit really is running the page-level rules', async () => {
  // Without this, a wrapper change could quietly put the shells back into fragment mode and the
  // page-level rules — the entire point of this file — would stop being evaluated.
  const result = await auditRenderedMarkup(
    '<!doctype html><html><head></head><body><div><p>orphaned</p></div></body></html>',
    { mode: 'document' },
  );
  const found = new Set(result.violations.map((violation) => violation.id));
  for (const expected of ['html-has-lang', 'document-title', 'landmark-one-main', 'region']) {
    assert.ok(
      found.has(expected),
      `page-level rule ${expected} did not fire; found ${[...found].join(', ')}`,
    );
  }
});
