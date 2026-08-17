/**
 * Record sheet: non-modal, complete in the documented order, precision stated verbatim.
 *
 * The precision assertion is character-exact. It is the archive's own statement about what its pin
 * means, and a paraphrase that softens "never draws a point sharper than the source supports"
 * would be a different, weaker claim.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { precisionNote, RecordSheet, type RecordSheetProps, type SheetRecord } from './RecordSheet';

const RECORD: SheetRecord = {
  id: 'ent_gaston_motel',
  name: 'A.G. Gaston Motel',
  kind: 'place',
  kindLabel: 'Place',
  place: 'Birmingham, Alabama',
  era: '1950s',
  story: 'Built in 1954, it became the campaign headquarters of the 1963 Birmingham movement.',
  precision: 'locality',
  confidenceTier: 'high',
  evidenceLabel: 'Grade A · 6 sources',
  sources: [
    { id: 's1', title: 'National Register nomination', detail: 'National Park Service' },
    { id: 's2', title: 'Birmingham Public Library archives' },
  ],
  connections: [
    { id: 'c1', name: '16th Street Baptist Church', kind: 'place', relation: 'four blocks from' },
  ],
};

function sheetProps(overrides: Partial<RecordSheetProps> = {}): RecordSheetProps {
  return { record: RECORD, onClose: () => {}, ...overrides };
}

function render(overrides: Partial<RecordSheetProps> = {}): string {
  return renderToStaticMarkup(createElement(RecordSheet, sheetProps(overrides)));
}

test('no record means no sheet', () => {
  assert.equal(render({ record: null }), '');
});

test('the sheet is a dialog that does not trap the reader on the map', () => {
  const html = render();
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="false"/, 'the map must stay operable behind the sheet');
  assert.match(html, /aria-labelledby="ds-sheet-name"/);
});

test('the precision note renders verbatim', () => {
  const html = render();
  assert.match(
    html,
    /Rendered at locality precision\. The archive never draws a point sharper than the source supports\./,
  );
});

test('the precision note renders for every record, not only imprecise ones', () => {
  const html = render({
    record: { ...RECORD, precision: 'address' },
  });
  assert.match(html, /Rendered at address precision\./);
});

test('precisionNote is the single definition of that sentence', () => {
  assert.equal(
    precisionNote('county'),
    'Rendered at county precision. The archive never draws a point sharper than the source supports.',
  );
});

test('the documented order holds: kicker, name, story, anatomy, precision, actions, sources', () => {
  const html = render({ onFlyToPlace: () => {} });
  const order = [
    'A.G. Gaston Motel',
    'campaign headquarters',
    'Evidence',
    'Rendered at locality precision',
    'Fly to place',
    'Sources',
  ];
  let cursor = -1;
  for (const marker of order) {
    const at = html.indexOf(marker);
    assert.ok(at > cursor, `"${marker}" is out of order in the sheet`);
    cursor = at;
  }
});

test('the anatomy grid is the shared one, with all four facts', () => {
  const html = render();
  for (const label of ['Kind', 'Where', 'Era', 'Evidence']) {
    assert.match(html, new RegExp(`>${label}<`), `anatomy is missing ${label}`);
  }
  assert.match(html, /Grade A · 6 sources/);
});

test('sources are numbered', () => {
  const html = render();
  assert.match(html, /National Register nomination/);
  assert.match(html, /Birmingham Public Library archives/);
  assert.match(html, /2 sources/);
});

test('a record with genuinely no sources says why rather than showing an empty list', () => {
  const html = render({ record: { ...RECORD, sources: [], sourceCount: 0 } });
  assert.match(html, /No sources are published for this record yet/);
});

test('the plate never claims a cited record has no sources', () => {
  // The Atlas passes a count without the citations, because the map payload is a count and a
  // confidence tier rather than a bibliography. The plate used to read "0 sources / no sources
  // are published for this record yet" directly beneath its own "Grade A · 1 source".
  const html = render({
    record: { ...RECORD, sources: [], sourceCount: 1, href: '/entity/abc' },
  });
  assert.doesNotMatch(html, /No sources are published for this record yet/);
  assert.match(html, /This record cites one source/);
  assert.match(html, /href="\/entity\/abc"/);
  assert.match(html, />1 source</);
});

test('the source count in the group label is the record count, not the carried list length', () => {
  const html = render({ record: { ...RECORD, sources: [], sourceCount: 4 } });
  assert.match(html, />4 sources</);
});

test('connections carry the relation slug', () => {
  const html = render();
  assert.match(html, /16th Street Baptist Church/);
  assert.match(html, /four blocks from/);
});

test('a record with no connections renders no connections section', () => {
  const html = render({ record: { ...RECORD, connections: [] } });
  assert.equal(html.includes('Documented connections'), false);
});

test('actions only render when the surface can perform them', () => {
  assert.equal(render().includes('Fly to place'), false);
  const wired = render({
    onFlyToPlace: () => {},
    onSave: () => {},
    onCite: () => {},
    onShare: () => {},
  });
  for (const action of ['Fly to place', 'Save', 'Cite', 'Share']) {
    assert.match(wired, new RegExp(`>${action}<`), `missing action: ${action}`);
  }
});

test('save reports whether the record is already saved', () => {
  const html = render({ onSave: () => {}, saved: true });
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, />Saved</);
});

test('position reads as n of N', () => {
  const html = render({ position: { index: 12, total: 4078 } });
  assert.match(html, /12 of 4,078/);
});

test('copy carries no em dash', () => {
  assert.equal(render({ onFlyToPlace: () => {}, onSave: () => {} }).includes('—'), false);
});

/* ---------------------------------------------------------------------------- *
 * SP-20 — the chapter-cites-record edge on the sheet.
 * ---------------------------------------------------------------------------- */

const CITED: SheetRecord = {
  ...RECORD,
  citingChapters: [
    {
      slug: 'birmingham-1963',
      title: 'Birmingham, 1963',
      relation: 'mapped in',
      href: '/stories/birmingham-1963',
    },
  ],
};

test('a cited record names the chapters that cite it, and how', () => {
  const html = render({ record: CITED });
  assert.match(html, /Chapters that cite this record/);
  assert.match(html, /href="\/stories\/birmingham-1963"/);
  assert.match(html, /Birmingham, 1963/);
  assert.match(html, /mapped in/, 'the relation must be stated in words, not implied');
});

test('a record no chapter cites renders no chapter section at all', () => {
  assert.equal(render().includes('Chapters that cite this record'), false);
  assert.equal(
    render({ record: { ...RECORD, citingChapters: [] } }).includes(
      'Chapters that cite this record',
    ),
    false,
    'an empty heading would read as a hole in the archive',
  );
});

test('the chapter count is stated alongside the heading', () => {
  assert.match(render({ record: CITED }), /1 chapter/);
  assert.match(
    render({
      record: {
        ...CITED,
        citingChapters: [
          ...(CITED.citingChapters ?? []),
          { slug: 'zoning', title: 'Zoning', relation: 'referenced in', href: '/stories/zoning' },
        ],
      },
    }),
    /2 chapters/,
  );
});

test('a connection with no page of its own still offers selection when the Atlas can select', () => {
  const html = render({ onSelectConnection: () => {} });
  assert.match(html, /ds-sheet__connection-select/);
});

test('without a select handler a page-less connection stays inert text, not a dead button', () => {
  assert.equal(render().includes('ds-sheet__connection-select'), false);
});

test('a connection that has a page keeps its real link', () => {
  const html = render({
    record: {
      ...RECORD,
      connections: [
        {
          id: 'c1',
          name: 'Kelly Ingram Park',
          kind: 'place',
          relation: 'across from',
          href: '/entity/c1',
        },
      ],
    },
    onSelectConnection: () => {},
  });
  assert.match(html, /href="\/entity\/c1"/, 'middle-click and copy-link must still work');
});

test('the source count describes the list on screen, not a different tally', () => {
  const html = render({
    record: {
      ...RECORD,
      // The plate's own evidenceCount, which counts the record's accepted claims rather than the
      // citations behind its documented relationships.
      sourceCount: 2,
      sources: [
        { id: 's1', title: 'One' },
        { id: 's2', title: 'Two' },
        { id: 's3', title: 'Three' },
      ],
    },
  });
  assert.match(html, /3 sources/);
  assert.equal(html.includes('2 sources'), false, 'the heading must not contradict its own list');
});

test('with no citations carried, the plate count still speaks for the record', () => {
  const html = render({ record: { ...RECORD, sourceCount: 6, sources: [] } });
  assert.match(html, /6 sources/);
  assert.match(html, /This record cites 6 sources\./);
});

/*
 * A reader who clicks a pin is asking about that entity. The sheet is a preview of its page, so
 * the page has to be reachable from the two places the reader looks first — the name they just
 * clicked, and the actions row — not only from a line under Sources that renders in one branch.
 */
test('the record page is reachable from the name and from the actions row', () => {
  const html = render({ record: { ...RECORD, href: '/entity/ent_gaston_motel' } });
  assert.match(
    html,
    /<a class="ds-sheet__name-link" href="\/entity\/ent_gaston_motel">A.G. Gaston Motel<\/a>/,
  );
  assert.match(html, /href="\/entity\/ent_gaston_motel"[^>]*>Open record</);
});

test('without an href the sheet offers no dead link, and the primary slot stays filled', () => {
  const html = render({ onFlyToPlace: () => {} });
  assert.equal(html.includes('Open record'), false);
  assert.equal(html.includes('ds-sheet__name-link'), false);
  assert.match(html, /ds-sheet__action ds-sheet__action--primary[^>]*>Fly to place</);
});
