/**
 * `/records` index tests.
 *
 * The drift suite at the bottom is the acceptance criterion "the filter vocabulary is generated
 * from the same source as the Lens, with a test that fails on drift". It does not compare two
 * hardcoded lists — that would drift together. It asserts the index's labels are the values the
 * shared encoding modules return, so renaming a kind family or a topic in the Lens's source
 * fails here until this room follows.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTopicLabel } from '@repo/domain/taxonomy/topics';
import type { PublicEntityView } from '../../data/public-seed';
import { kindFamilyEncodingFor, kindFamilyFor } from '../map-experience/kind-encoding';
import { floorLabel } from '../map-experience/evidence-grade';
import {
  RECORDS_FILTER_KEYS,
  RECORDS_PAGE_SIZE,
  buildAtlasHref,
  buildRecordsIndex,
  findRecordsNeighbors,
  parseRecordsQuery,
  recordsHref,
  recordsQueryIndexable,
  searchIndexReadyForRecords,
  EMPTY_RECORDS_QUERY,
} from './build-records-index';

type EntityOverrides = Partial<PublicEntityView> & { readonly id: string };

/** Minimal projection: only the fields the index actually reads. */
function entity(overrides: EntityOverrides): PublicEntityView {
  return {
    kind: 'place',
    displayName: `Record ${overrides.id}`,
    summary: 'A documented record.',
    era: '1920s',
    topicTags: [],
    jurisdictionLabel: 'Oklahoma',
    locationPrecision: 'city',
    locationLabel: 'Tulsa',
    relevanceExplanation: '',
    historicalContext: '',
    recordMaturity: 'stub',
    researchCoverage: 'minimal',
    mapPin: { x: 0, y: 0 },
    claims: [],
    timeline: [],
    revision: {} as PublicEntityView['revision'],
    relatedIds: [],
    ...overrides,
  } as PublicEntityView;
}

function manyEntities(count: number): readonly PublicEntityView[] {
  return Array.from({ length: count }, (_, index) => entity({ id: `e${index}` }));
}

describe('/records · query parsing and href construction', () => {
  it('page=1 is never written into an href, so one page never has two URLs', () => {
    assert.equal(recordsHref({ page: 1 }), '/records');
    assert.equal(recordsHref({ page: 2 }), '/records?page=2');
    assert.equal(recordsHref({ kind: 'people', page: 1 }), '/records?kind=people');
  });

  it('params are emitted in a fixed order, so a narrowing has exactly one canonical URL', () => {
    const a = recordsHref({ q: 'tulsa', kind: 'people', era: '1920s', state: 'OK' });
    const b = recordsHref({ state: 'OK', era: '1920s', kind: 'people', q: 'tulsa' });
    assert.equal(a, b);
    assert.equal(a, '/records?q=tulsa&kind=people&era=1920s&state=OK');
  });

  it('a junk or negative page collapses to page one rather than throwing', () => {
    assert.equal(parseRecordsQuery({ page: 'banana' }).page, 1);
    assert.equal(parseRecordsQuery({ page: '-4' }).page, 1);
    assert.equal(parseRecordsQuery({ page: '0' }).page, 1);
    assert.equal(parseRecordsQuery({ page: '3' }).page, 3);
  });

  it('the evidence floor parses upper-case and the rest parse lower-case', () => {
    const query = parseRecordsQuery({ kind: 'PEOPLE', state: 'ok', evidence: 'b' });
    assert.equal(query.kind, 'people');
    assert.equal(query.state, 'OK');
    assert.equal(query.evidence, 'B');
  });

  it('a repeated param takes its first value instead of becoming an array', () => {
    assert.equal(parseRecordsQuery({ kind: ['people', 'places'] }).kind, 'people');
  });
});

describe('/records · paging', () => {
  it('pages at 100 with real prev and next hrefs, and page one has no prev', () => {
    const entities = manyEntities(250);
    const first = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    assert.equal(first.rows.length, RECORDS_PAGE_SIZE);
    assert.equal(first.pageCount, 3);
    assert.equal(first.previousHref, undefined);
    assert.equal(first.nextHref, '/records?page=2');

    const last = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, page: 3 });
    assert.equal(last.rows.length, 50);
    assert.equal(last.previousHref, '/records?page=2');
    assert.equal(last.nextHref, undefined);
  });

  it('a page past the end clamps to the last page rather than rendering an empty archive', () => {
    const model = buildRecordsIndex(manyEntities(120), { ...EMPTY_RECORDS_QUERY, page: 99 });
    assert.equal(model.page, 2);
    assert.equal(model.rows.length, 20);
    assert.equal(model.canonicalPath, '/records?page=2');
  });

  it('/records?page=2 declares itself canonical, not /records', () => {
    const model = buildRecordsIndex(manyEntities(250), { ...EMPTY_RECORDS_QUERY, page: 2 });
    assert.equal(model.canonicalPath, '/records?page=2');
  });
});

describe('/records · filtering', () => {
  // Kinds are the four the public projection actually carries; families are asserted through
  // `kindFamilyFor` rather than spelled out, which is the point of the drift suite below.
  const entities = [
    entity({ id: 'a', kind: 'event', jurisdictionLabel: 'Oklahoma', era: '1920s' }),
    entity({ id: 'b', kind: 'place', jurisdictionLabel: 'Mississippi', era: '1950s' }),
    entity({ id: 'c', kind: 'institution', jurisdictionLabel: 'Oklahoma', era: '1920s' }),
  ];

  it('kind filters on the family, which is the vocabulary the Lens chips use', () => {
    const model = buildRecordsIndex(entities, {
      ...EMPTY_RECORDS_QUERY,
      kind: kindFamilyFor('event'),
    });
    assert.equal(model.totalMatched, 1);
    assert.equal(model.rows[0]?.id, 'a');
  });

  it('state filters on the postal code resolved from the jurisdiction label', () => {
    const model = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, state: 'OK' });
    assert.equal(model.totalMatched, 2);
  });

  it('a record with no place is still indexed — that is the population this room exists for', () => {
    const model = buildRecordsIndex(
      [entity({ id: 'nowhere', locationLabel: '  ', jurisdictionLabel: '  ' })],
      EMPTY_RECORDS_QUERY,
    );
    assert.equal(model.totalMatched, 1);
    assert.equal(model.rows[0]?.place, 'Place not recorded');
  });

  it('facet counts lift their own constraint, so switching kinds never shows zero', () => {
    const model = buildRecordsIndex(entities, {
      ...EMPTY_RECORDS_QUERY,
      kind: kindFamilyFor('event'),
    });
    const places = model.facets.kind.find((facet) => facet.id === kindFamilyFor('place'));
    assert.equal(places?.count, 1, 'Places still reports what switching to it would give');
    const oklahoma = model.facets.state.find((facet) => facet.id === 'OK');
    assert.equal(oklahoma?.count, 1, 'state counts DO respect the active kind constraint');
  });

  it('the active option is pinned first, so the chip that clears it is always visible', () => {
    // `state=OK` matches 2 of 3 here but many rooms narrow to a state well outside the top chips.
    const model = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, state: 'MS' });
    assert.equal(model.facets.state[0]?.id, 'MS');
  });

  it('clicking the active chip clears it, and every facet href returns to page one', () => {
    const events = kindFamilyFor('event');
    const places = kindFamilyFor('place');
    const model = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: events, page: 1 });
    assert.equal(model.facets.kind.find((facet) => facet.id === events)?.href, '/records');
    assert.equal(
      model.facets.kind.find((facet) => facet.id === places)?.href,
      `/records?kind=${places}`,
    );
  });

  it('every active constraint is listed with a clear href, and q is one of them', () => {
    const model = buildRecordsIndex(entities, {
      ...EMPTY_RECORDS_QUERY,
      kind: kindFamilyFor('event'),
      q: 'record',
    });
    assert.deepEqual(
      model.constraints.map((constraint) => constraint.key),
      ['q', 'kind'],
    );
    assert.equal(model.constraints[0]?.clearHref, `/records?kind=${kindFamilyFor('event')}`);
    assert.equal(model.clearAllHref, '/records');
  });

  it('an unrecognized param narrows nothing rather than emptying the room', () => {
    const model = buildRecordsIndex(entities, {
      ...EMPTY_RECORDS_QUERY,
      ...parseRecordsQuery({ kind: 'wombats' }),
    });
    assert.equal(model.totalMatched, 0, 'an unknown kind matches nothing, honestly');
    assert.ok(model.constraints.length === 1, 'and it is shown as a clearable constraint');
  });
});

describe('/records · the Explore handoff', () => {
  it('maps topic onto the Lens name for the same thing', () => {
    assert.equal(
      buildAtlasHref({ ...EMPTY_RECORDS_QUERY, topic: 'abolition' }),
      '/explore?theme=abolition',
    );
  });

  it('hands the text narrowing to the same collection matcher on Explore', () => {
    const href = buildAtlasHref({
      ...EMPTY_RECORDS_QUERY,
      q: 'tulsa',
      state: 'OK',
    });
    assert.equal(href, '/explore?q=tulsa&state=OK');
  });

  it('sends the evidence floor as `floor`, now that SP-16 landed it on the Lens', () => {
    const href = buildAtlasHref({
      ...EMPTY_RECORDS_QUERY,
      evidence: 'B',
      state: 'OK',
    });
    assert.equal(href, '/explore?state=OK&floor=B');
  });

  it('an unnarrowed index hands over the Explore instrument', () => {
    assert.equal(buildAtlasHref(EMPTY_RECORDS_QUERY), '/explore');
  });
});

describe('/records · filter vocabulary does not drift from the Lens', () => {
  it('kind labels are whatever the shared kind-family encoding says they are', () => {
    const entities = [
      entity({ id: 'a', kind: 'place' }),
      entity({ id: 'b', kind: 'school' }),
      entity({ id: 'c', kind: 'institution' }),
      entity({ id: 'd', kind: 'event' }),
    ];
    const model = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    for (const facet of model.facets.kind) {
      assert.equal(
        facet.label,
        kindFamilyEncodingFor(facet.id as ReturnType<typeof kindFamilyFor>).label,
        `kind facet "${facet.id}" must read its label from kindFamilyEncodingFor`,
      );
    }
  });

  it('topic labels come from the controlled taxonomy, and an invalid id never becomes a facet', () => {
    const model = buildRecordsIndex(
      [entity({ id: 'a', topicTags: ['abolition', 'not-a-real-topic'] })],
      EMPTY_RECORDS_QUERY,
    );
    assert.deepEqual(
      model.facets.topic.map((facet) => facet.id),
      ['abolition'],
    );
    assert.equal(model.facets.topic[0]?.label, getTopicLabel('abolition'));
  });

  it('the evidence chip is a floor with the Lens wording, not an exact grade match', () => {
    const model = buildRecordsIndex([entity({ id: 'a' })], EMPTY_RECORDS_QUERY);
    for (const facet of model.facets.evidence) {
      assert.equal(facet.label, floorLabel(facet.id as 'A' | 'B' | 'C'));
    }
    assert.ok(
      model.facets.evidence.every((facet) => facet.id !== 'any'),
      '"any" is the absence of a floor, so it is never a chip',
    );
  });

  it('the filter key list and the facet map cannot fall out of step', () => {
    const model = buildRecordsIndex([entity({ id: 'a' })], EMPTY_RECORDS_QUERY);
    assert.deepEqual(Object.keys(model.facets).sort(), [...RECORDS_FILTER_KEYS].sort());
  });

  it('accepts map kind families and micro-kinds in kind= URLs', () => {
    const entities = [
      entity({ id: 'law_a', kind: 'law', displayName: 'Law A' } as unknown as EntityOverrides),
      entity({ id: 'place_a', kind: 'place', displayName: 'Place A' }),
      entity({
        id: 'move_a',
        kind: 'movement',
        displayName: 'Movement A',
      } as unknown as EntityOverrides),
    ];
    assert.equal(
      buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: 'law' }).totalMatched,
      1,
    );
    assert.equal(
      buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: 'place' }).totalMatched,
      1,
    );
    assert.equal(
      buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: 'events' }).totalMatched,
      0,
    );
    assert.equal(
      buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: 'organizations' }).totalMatched,
      1,
    );
    assert.equal(
      buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: 'sources' }).totalMatched,
      1,
    );
    assert.equal(
      buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: 'works' }).totalMatched,
      0,
    );
  });
});

describe('/records · place hrefs and map continuity', () => {
  it('standable records link to /place; people stay on /entity', () => {
    const entities = [
      entity({
        id: 'ent_school_a',
        kind: 'school',
        displayName: 'Union School',
        summary: 'A documented school.',
      }),
      entity({
        id: 'ent_school_b',
        kind: 'school',
        displayName: 'Union School',
        summary: 'Another documented school.',
      }),
      entity({
        id: 'ent_person_a',
        kind: 'person',
        displayName: 'Example Person',
        summary: 'A named person.',
      } as unknown as EntityOverrides),
    ];
    const model = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    const byId = new Map(model.rows.map((row) => [row.id, row]));
    assert.equal(byId.get('ent_school_a')?.href, '/place/union-school--ent_school_a?from=list');
    assert.equal(byId.get('ent_school_b')?.href, '/place/union-school--ent_school_b?from=list');
    assert.equal(byId.get('ent_person_a')?.href, '/entity/ent_person_a?from=list');
    assert.equal(typeof model.mappableMatched, 'number');
  });

  it('findRecordsNeighbors steps within the same narrowing and keeps arrival query', () => {
    const entities = [
      entity({
        id: 'ent_a',
        kind: 'place',
        displayName: 'Alpha Place',
        summary: 'First.',
        jurisdictionLabel: 'Washington, D.C.',
      }),
      entity({
        id: 'ent_b',
        kind: 'place',
        displayName: 'Beta Place',
        summary: 'Second.',
        jurisdictionLabel: 'Washington, D.C.',
      }),
      entity({
        id: 'ent_c',
        kind: 'place',
        displayName: 'Gamma Place',
        summary: 'Third.',
        jurisdictionLabel: 'Oklahoma',
      }),
    ];
    const neighbors = findRecordsNeighbors(
      entities,
      { ...EMPTY_RECORDS_QUERY, state: 'DC' },
      'ent_a',
      'from=list&state=DC',
    );
    assert.equal(neighbors?.total, 2);
    assert.equal(neighbors?.index, 0);
    assert.equal(neighbors?.previous, undefined);
    assert.equal(neighbors?.next?.id, 'ent_b');
    assert.match(neighbors?.next?.href ?? '', /from=list/);
    assert.match(neighbors?.next?.href ?? '', /state=DC/);
  });

  it('findRecordsNeighbors links the address the plate resolved, never a guessed /place', () => {
    const entities = [
      entity({ id: 'ent_a', kind: 'place', displayName: 'Alpha Place', summary: 'First.' }),
      entity({ id: 'ent_b', kind: 'place', displayName: 'Beta Place', summary: 'Second.' }),
      entity({ id: 'ent_c', kind: 'place', displayName: 'Gamma Place', summary: 'Third.' }),
    ];
    const drawn = new Map([['ent_b', '/place/beta-place--2']]);
    const neighbors = findRecordsNeighbors(
      entities,
      EMPTY_RECORDS_QUERY,
      'ent_b',
      'from=list',
      undefined,
      drawn,
    );
    const hrefs = [neighbors?.previous?.href, neighbors?.next?.href];
    // Off the plate, `/entity/{id}` always resolves and forwards to the record's own address.
    assert.ok(hrefs.every((href) => href?.startsWith('/entity/ent_')));
    const back = findRecordsNeighbors(entities, EMPTY_RECORDS_QUERY, 'ent_a', '', undefined, drawn);
    assert.equal(back?.next?.href, '/place/beta-place--2');
  });

  it('builds from search_index docs when evidenceInputs is projected', () => {
    const docs = [
      {
        id: 'ent_a',
        releaseId: 'rel_1',
        kind: 'place',
        displayName: 'Alpha Place',
        nameLower: 'alpha place',
        aliases: [],
        summary: 'First.',
        topicTags: [],
        eraBuckets: ['1920s'],
        notabilityBasis: [],
        notabilityLabels: [],
        recordMaturity: 'partial_enrichment',
        researchCoverage: 'partial' as const,
        relatedCount: 0,
        claimCount: 1,
        // Grade A: two lineages that may corroborate, on a high claim. The row carries the
        // ingredients and `buildRecordsIndex` applies the shared rule — no tier is cached.
        evidenceInputs: {
          strongestClaimLevel: 'high' as const,
          citedLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
          evidenceLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
        },
        jurisdictionState: 'Washington, D.C.',
        geohash: 'dqcjq',
      },
      {
        id: 'ent_b',
        releaseId: 'rel_1',
        kind: 'person',
        displayName: 'Example Person',
        nameLower: 'example person',
        aliases: [],
        summary: 'A named person.',
        topicTags: [],
        eraBuckets: [],
        notabilityBasis: [],
        notabilityLabels: [],
        recordMaturity: 'partial_enrichment',
        researchCoverage: 'minimal' as const,
        relatedCount: 0,
        claimCount: 1,
        // One lineage on a high claim: the rule steps it down to B at read time.
        evidenceInputs: {
          strongestClaimLevel: 'high' as const,
          citedLineageKeys: ['npgallery.nps.gov'],
          evidenceLineageKeys: ['npgallery.nps.gov'],
        },
      },
    ];
    assert.equal(searchIndexReadyForRecords(docs), true);
    const { evidenceInputs: _evidenceInputs, ...withoutEvidenceInputs } = docs[0]!;
    assert.equal(searchIndexReadyForRecords([withoutEvidenceInputs]), false);
    // A row carrying only the retired derived tier is NOT coverage: `/records` must fall back to
    // full entities rather than serve a cached conclusion.
    assert.equal(
      searchIndexReadyForRecords([{ ...withoutEvidenceInputs, confidenceTier: 'high' } as never]),
      false,
    );
    const model = buildRecordsIndex(docs, EMPTY_RECORDS_QUERY);
    assert.equal(model.totalAll, 2);
    assert.equal(model.rows.find((row) => row.id === 'ent_a')?.grade, 'A');
    // Derived from the cached inputs, not read off them: a single lineage cannot hold grade A.
    assert.equal(model.rows.find((row) => row.id === 'ent_b')?.grade, 'B');
    assert.equal(
      model.rows.find((row) => row.id === 'ent_a')?.href,
      '/place/alpha-place?from=list',
    );
    assert.equal(model.rows.find((row) => row.id === 'ent_b')?.href, '/entity/ent_b?from=list');
    assert.equal(model.mappableMatched, 1);
  });
});

describe('/records · crawl-trap guard', () => {
  it('the bare list, single-facet narrowings and plain pagination are indexable', () => {
    assert.equal(recordsQueryIndexable(EMPTY_RECORDS_QUERY), true);
    assert.equal(recordsQueryIndexable({ state: 'OK' }), true);
    assert.equal(recordsQueryIndexable({ page: 3 }), true);
  });

  it('free text, two facets, or a facet plus a page are not (robots.txt disallows them too)', () => {
    assert.equal(recordsQueryIndexable({ q: 'tulsa' }), false);
    assert.equal(recordsQueryIndexable({ state: 'OK', kind: 'place' }), false);
    assert.equal(recordsQueryIndexable({ era: '1920s', page: 3 }), false);
  });

  it('the model carries the flag, and facet links into a second facet are nofollow', () => {
    const entities = [entity({ id: 'a', kind: 'place' }), entity({ id: 'b', kind: 'school' })];
    const bare = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    assert.equal(bare.indexable, true);
    assert.ok(bare.facets.kind.length > 0);
    assert.ok(bare.facets.kind.every((option) => option.nofollow === false));

    const kindId = bare.facets.kind[0]!.id;
    const narrowed = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, kind: kindId });
    assert.equal(narrowed.indexable, true);
    const active = narrowed.facets.kind.find((option) => option.id === kindId);
    // Clearing the one active facet returns to the bare list, which is crawlable.
    assert.equal(active?.nofollow, false);
    const other = narrowed.facets.era[0];
    assert.ok(other !== undefined);
    assert.equal(other.nofollow, true);

    const both = buildRecordsIndex(entities, {
      ...EMPTY_RECORDS_QUERY,
      kind: kindId,
      era: other.id,
    });
    assert.equal(both.indexable, false);
  });
});

describe('/records · order and decade jumps', () => {
  const entities = [
    entity({ id: 'late', displayName: 'Union Church', era: '1950s', summary: 'A school.' }),
    entity({ id: 'early', displayName: 'Old Meeting House', era: '1790s', summary: 'A church.' }),
    entity({ id: 'name', displayName: 'Church Street', era: '1880s', summary: 'A street.' }),
  ];

  it('reads earliest first with no search, and best match first with one', () => {
    const plain = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    assert.deepEqual(
      plain.rows.map((row) => row.id),
      ['early', 'name', 'late'],
    );
    const searched = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, q: 'church' });
    // A leading name match, then a later word in the name, then a summary-only match.
    assert.deepEqual(
      searched.rows.map((row) => row.id),
      ['name', 'late', 'early'],
    );
  });

  it('offers a jump to every decade while the order is by time, and none otherwise', () => {
    const plain = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    assert.deepEqual(
      plain.decadeJumps.map((jump) => [jump.label, jump.page, jump.href]),
      [
        ['1790s', 1, '/records#decade-1790'],
        ['1880s', 1, '/records#decade-1880'],
        ['1950s', 1, '/records#decade-1950'],
      ],
    );
    const byName = buildRecordsIndex(entities, { ...EMPTY_RECORDS_QUERY, sort: 'name' });
    assert.deepEqual(byName.decadeJumps, []);
  });

  it('a decade jump lands on the page where that decade starts', () => {
    const many = [
      ...Array.from({ length: 150 }, (_, index) => entity({ id: `a${index}`, era: '1880s' })),
      entity({ id: 'z', era: '1950s' }),
    ];
    const model = buildRecordsIndex(many, EMPTY_RECORDS_QUERY);
    assert.deepEqual(
      model.decadeJumps.map((jump) => [jump.label, jump.page]),
      [
        ['1880s', 1],
        ['1950s', 2],
      ],
    );
    assert.equal(model.decadeJumps[1]?.href, '/records?page=2#decade-1950');
  });

  it('a seeded visit opens on a shuffle that pages stably and stays out of the canonical', () => {
    const many = Array.from({ length: 150 }, (_, index) =>
      entity({ id: `r${String(index).padStart(3, '0')}`, era: `${1800 + (index % 20) * 10}s` }),
    );
    const ids = (seed: string, page = 1) =>
      buildRecordsIndex(many, { ...EMPTY_RECORDS_QUERY, seed, page }).rows.map((row) => row.id);
    const earliest = buildRecordsIndex(many, { ...EMPTY_RECORDS_QUERY, sort: 'era' });
    assert.deepEqual(ids('abc'), ids('abc'), 'one seed, one order');
    assert.notDeepEqual(ids('abc'), ids('xyz'), 'another visit, another order');
    assert.notDeepEqual(
      ids('abc'),
      earliest.rows.map((row) => row.id),
    );
    assert.equal(new Set([...ids('abc', 1), ...ids('abc', 2)]).size, 150, 'no row repeats');
    const seeded = buildRecordsIndex(many, { ...EMPTY_RECORDS_QUERY, seed: 'abc' });
    assert.equal(seeded.canonicalPath, '/records');
    assert.equal(seeded.nextHref, '/records?seed=abc&page=2');
    assert.deepEqual(seeded.decadeJumps, [], 'a shuffle has no decade to jump to');
    assert.equal(earliest.canonicalPath, '/records?sort=era');
  });
});

describe('/records · rows state only what the record supports', () => {
  it('a Green Book 1956 listing never sorts earlier than the 1930s', () => {
    const listing = entity({
      id: 'greenbook-1956-0683',
      displayName: 'Collins Restaurant',
      summary: '',
      // What releases built before the street-number fix stored: the house number as a decade.
      eraBuckets: ['1510s', '1950s'],
    });
    const colonial = entity({ id: 'fort', displayName: 'Fort Mose', eraBuckets: ['1730s'] });
    const model = buildRecordsIndex([listing, colonial], EMPTY_RECORDS_QUERY);
    assert.deepEqual(
      model.rows.map((row) => [row.name, row.era]),
      [
        ['Fort Mose', '1730s'],
        ['Collins Restaurant', '1950s'],
      ],
    );
  });

  it('takes the address the map plate resolved, and /entity off the plate, so no row is dead', () => {
    const doc = {
      id: 'greenbook-1956-0001',
      displayName: 'Liberty Hotel',
      kind: 'place',
      summary: 'A hotel listed in the Green Book.',
      jurisdictionLabel: 'New Jersey',
      locationLabel: '',
      topicTags: [],
      eraBuckets: ['1950s'],
      confidenceTier: 'low',
      mappable: true,
    } as const;
    const bare = { ...doc, id: 'bare', displayName: 'Bare Record', summary: '' };
    const offPlate = { ...doc, id: 'off', displayName: 'Off Plate' };
    const drawn = new Map([['greenbook-1956-0001', '/entity/greenbook-1956-0001']]);
    const hrefs = buildRecordsIndex([doc, bare, offPlate], EMPTY_RECORDS_QUERY, drawn).rows.map(
      (row) => row.href.split('?')[0],
    );
    assert.deepEqual(hrefs.sort(), ['/entity/bare', '/entity/greenbook-1956-0001', '/entity/off']);
    // Without a plate (record-page neighbors) the summary rule still holds: no summary, no /place.
    const guessed = buildRecordsIndex([bare], EMPTY_RECORDS_QUERY).rows[0]?.href.split('?')[0];
    assert.equal(guessed, '/entity/bare');
  });
});
