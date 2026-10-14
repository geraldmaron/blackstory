/**
 * axe-core over the markup the real `@repo/ui` components produce.
 *
 * This is the part of the accessibility lane that cannot drift. Every case below renders an
 * actual exported component through `renderToStaticMarkup` and hands the result to axe. Nothing
 * here is a hand-written HTML string standing in for a component, so a component that regresses
 * fails here — the fixture checks in `audit.ts` / `html-smoke.ts` could not do that, because the
 * fixture and the component it stood for were maintained separately.
 *
 * Read `axe-harness.ts`'s header for what axe under jsdom does and, more importantly, does not
 * check. The short version: no color contrast, no layout, no interaction, one static state per
 * case. A green run here means "no machine-detectable violation in this markup". It does not mean
 * the component is accessible.
 *
 * Each component is audited in isolation, so page-level collisions — two `main` landmarks, a
 * duplicate `id`, a second `h1` — cannot show up here. `journey-shells.test.ts` composes these
 * same real components into whole-page markup and catches those.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  Card,
  Citation,
  Confidence,
  DataTable,
  DetailField,
  DetailPanel,
  Dialog,
  EmptyState,
  FacetRail,
  FilterBar,
  InlineEdit,
  MapExplorer,
  MapFrame,
  Notice,
  Pagination,
  ResultList,
  SelectionBar,
  Timeline,
  Toolbar,
} from '@repo/ui';
import { auditRenderedMarkup, describeViolations } from './axe-harness.ts';
import { KNOWN_COMPONENT_FINDINGS, partitionViolations } from './known-findings.ts';

const BRAND = { light: '/brand/light.svg', dark: '/brand/dark.svg' } as const;

type ArchiveRow = { readonly id: string; readonly name: string; readonly year: number };

const RECORDS: readonly ArchiveRow[] = [
  { id: 'ent_1', name: 'Harlem Cultural Corridor', year: 1926 },
  { id: 'ent_2', name: 'Sweet Auburn Historic District', year: 1908 },
];

/**
 * Every case is a real component with props a real page would pass. Where a component takes
 * children or slots, they are filled with what a caller actually puts there — an empty slot, or a
 * slot filled with something no caller would pass, audits markup no reader ever sees.
 */
const CASES: readonly (readonly [string, ReactElement])[] = [
  ['Button', createElement(Button, { variant: 'primary' }, 'Open the record')],
  [
    'Card',
    createElement(
      Card,
      { title: 'Sweet Auburn', meta: 'Atlanta, Georgia' },
      'A commercial district that anchored Black Atlanta.',
    ),
  ],
  [
    'Citation',
    createElement(Citation, {
      source: 'National Register of Historic Places',
      href: 'https://npgallery.nps.gov/NRHP',
    }),
  ],
  [
    'Citation (dead link)',
    createElement(Citation, {
      source: 'City of Atlanta planning archive',
      href: 'https://example.gov/gone',
      linkStatus: 'dead',
      deadAsOfDate: '2026-01-14',
      archivedHref: 'https://web.archive.org/web/2020/https://example.gov/gone',
      trySearchingFor: 'Atlanta planning archive Sweet Auburn',
    }),
  ],
  ['Confidence', createElement(Confidence, { level: 'high' })],
  [
    'DataTable',
    createElement(DataTable<ArchiveRow>, {
      caption: 'Documented records',
      rows: RECORDS,
      rowKey: (row) => row.id,
      rowHref: (row) => `/entity/${row.id}`,
      columns: [
        { id: 'name', header: 'Record', cell: (row) => row.name, sortHref: '?sort=name' },
        { id: 'year', header: 'Year', cell: (row) => row.year, align: 'end' },
      ],
    }),
  ],
  [
    'DetailPanel',
    createElement(
      DetailPanel,
      {
        title: 'Provenance',
        meta: 'ent_1 · updated 2026-02-02',
        actions: createElement(Button, { variant: 'secondary' }, 'Edit'),
      },
      createElement(DetailField, { label: 'Sources' }, 'Two independent records place it here.'),
      createElement(DetailField, { label: 'Aliases' }),
    ),
  ],
  [
    'Dialog',
    createElement(
      Dialog,
      { open: true, title: 'Confirm correction', onClose: () => {} },
      'This edit is published immediately.',
    ),
  ],
  [
    'EmptyState',
    createElement(EmptyState, { title: 'No records match' }, 'Widen the era or clear a filter.'),
  ],
  [
    'FacetRail',
    createElement(FacetRail, {
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
  ],
  [
    'FilterBar',
    createElement(FilterBar, {
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
  ],
  [
    'InlineEdit',
    createElement(
      InlineEdit,
      {
        action: '/entity/ent_1/edit',
        method: 'post',
        hiddenFields: { entityId: 'ent_1', field: 'displayName' },
        status: 'error',
        message: 'That name is already taken.',
      },
      createElement(
        'p',
        null,
        createElement('label', { htmlFor: 'display-name' }, 'Display name'),
        createElement('input', { id: 'display-name', name: 'displayName', type: 'text' }),
      ),
    ),
  ],
  [
    'MapExplorer',
    createElement(MapExplorer, {
      title: 'Documented places',
      caption: 'The legend beside the map carries the same records.',
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
  ],
  [
    'MapFrame',
    createElement(MapFrame, {
      title: 'Neighborhood map',
      caption: 'Approximate block-level placement.',
      pins: [{ id: 'p1', label: 'School site', x: 40, y: 50 }],
    }),
  ],
  [
    'Notice',
    createElement(
      Notice,
      { tone: 'dispute', title: 'Sources disagree' },
      'Two dates are recorded.',
    ),
  ],
  [
    'Pagination',
    createElement(Pagination, {
      page: 3,
      pageCount: 40,
      pageSize: 25,
      total: 1000,
      hrefForPage: (page) => `/records?page=${page}`,
    }),
  ],
  [
    'ResultList',
    createElement(ResultList, {
      items: RECORDS.map((row) => ({
        id: row.id,
        href: `/entity/${row.id}`,
        title: row.name,
        summary: `Documented from ${row.year}.`,
      })),
    }),
  ],
  [
    'SelectionBar',
    createElement(SelectionBar, {
      selectedCount: 2,
      matchCount: 1000,
      onClear: () => {},
      onSelectAllMatches: () => {},
    }),
  ],
  [
    'Timeline',
    createElement(Timeline, {
      items: [
        { id: '1', time: '1963', title: 'March on Washington', body: 'Two hundred thousand.' },
      ],
    }),
  ],
  [
    'Toolbar',
    createElement(
      Toolbar,
      {
        label: 'Record search',
        action: '/records',
        method: 'get',
        preservedParams: { era: '1900s' },
        actions: createElement(Button, { type: 'submit' }, 'Search'),
      },
      createElement(
        'p',
        null,
        createElement('label', { htmlFor: 'toolbar-q' }, 'Find a record'),
        createElement('input', { id: 'toolbar-q', name: 'q', type: 'search' }),
      ),
    ),
  ],
];

for (const [name, element] of CASES) {
  test(`${name} renders markup with no axe violation`, async () => {
    const markup = renderToStaticMarkup(element);
    assert.notEqual(markup, '', `${name} rendered nothing — the case props produce an empty tree`);
    const result = await auditRenderedMarkup(markup);
    const { unexpected, matchedKnown } = partitionViolations(
      name,
      result.violations,
      KNOWN_COMPONENT_FINDINGS,
    );

    assert.ok(
      unexpected.length === 0,
      `${name} has ${unexpected.length} axe violation(s):\n${describeViolations(unexpected)}`,
    );

    // A known finding that has been fixed must be struck from the register, or the register
    // slowly turns into a list of things that used to be wrong and nobody trusts it.
    const stale = KNOWN_COMPONENT_FINDINGS.filter(
      (finding) => finding.subjects.includes(name) && !matchedKnown.has(finding.ruleId),
    );
    assert.equal(
      stale.length,
      0,
      `${name} no longer violates ${stale.map((finding) => finding.ruleId).join(', ')} — delete the entry from known-findings.ts`,
    );
  });
}

test('ShellHeader is still unrenderable outside Next, and so is still unaudited', async () => {
  // The one gap in the list above, recorded as a test so it cannot be quietly forgotten.
  //
  // `ShellHeader` and its child `ShellWordmark` are the only two components in `@repo/ui` without
  // the `import React ... void React;` line every sibling carries. There is no tsconfig at the
  // repo root, so tsx transpiles JSX with the classic runtime and the compiled module references
  // a free `React`. Next's own compiler uses `jsx: preserve`, so the site header is fine in
  // production — but it cannot be server-rendered in any Node test, which leaves the most-visited
  // chrome on the site with no axe coverage at all.
  //
  // The fix is one line in each of the two files, matching the siblings. That is a `packages/ui`
  // change, deliberately not made here. When it lands, this test fails: move ShellHeader into
  // CASES above and delete this.
  const { ShellHeader } = await import('@repo/ui');
  assert.throws(
    () =>
      renderToStaticMarkup(
        createElement(ShellHeader, {
          pathname: '/records',
          homeHref: '/',
          primaryNav: [{ href: '/records', label: 'Records' }],
          overflowNav: [],
          brandLockup: BRAND,
          brandSymbol: BRAND,
        }),
      ),
    /React is not defined/,
    'ShellHeader now renders under Node — audit it in CASES instead of documenting it here',
  );
});

test('the lane fails on markup that is actually broken', async () => {
  // A guard on the guard. If the harness ever silently stops evaluating — a jsdom upgrade, an axe
  // API change, a swallowed error — every test above turns green for the wrong reason. This case
  // asserts that markup with known violations still produces them.
  const result = await auditRenderedMarkup(
    '<button></button><img src="/x.png"><a href="/y"></a><div role="notarole">x</div>',
  );
  const found = new Set(result.violations.map((violation) => violation.id));
  for (const expected of ['button-name', 'image-alt', 'link-name', 'aria-roles']) {
    assert.ok(
      found.has(expected),
      `harness did not report ${expected}; found ${[...found].join(', ')}`,
    );
  }
});

test('color contrast is not silently reported as passing', async () => {
  // The honesty guard. jsdom cannot resolve a painted background, so axe can never decide
  // color-contrast here; the harness disables the rule outright rather than leaving it in
  // "incomplete", where a reader skimming a report might mistake it for coverage. If a future
  // jsdom or axe makes the rule decidable, this fails and forces the module docs to be corrected
  // along with it.
  const result = await auditRenderedMarkup(
    '<p style="color:#eeeeee;background:#ffffff">1.2:1 text</p>',
  );
  assert.ok(
    !result.violations.some((violation) => violation.id === 'color-contrast'),
    'color-contrast reported a violation under jsdom — re-check axe-harness.ts docs before trusting it',
  );
  assert.ok(
    !result.undecided.includes('color-contrast'),
    'color-contrast ran and could not decide; it should be disabled outright',
  );
});
