/**
 * `/records` index tests (SP-09, repo-92n2.9).
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

  it('an unrecognised param narrows nothing rather than emptying the room', () => {
    const model = buildRecordsIndex(entities, {
      ...EMPTY_RECORDS_QUERY,
      ...parseRecordsQuery({ kind: 'wombats' }),
    });
    assert.equal(model.totalMatched, 0, 'an unknown kind matches nothing, honestly');
    assert.ok(model.constraints.length === 1, 'and it is shown as a clearable constraint');
  });
});

describe('/records · the Atlas handoff', () => {
  it('maps topic onto the Lens name for the same thing', () => {
    assert.equal(
      buildAtlasHref({ ...EMPTY_RECORDS_QUERY, topic: 'abolition' }),
      '/explore?theme=abolition',
    );
  });

  it('never sends q, because the Atlas has no text constraint at all', () => {
    const href = buildAtlasHref({
      ...EMPTY_RECORDS_QUERY,
      q: 'tulsa',
      state: 'OK',
    });
    assert.equal(href, '/explore?state=OK');
  });

  it('sends the evidence floor as `floor`, now that SP-16 landed it on the Lens', () => {
    const href = buildAtlasHref({
      ...EMPTY_RECORDS_QUERY,
      evidence: 'B',
      state: 'OK',
    });
    assert.equal(href, '/explore?state=OK&floor=B');
  });

  it('an unnarrowed index hands over the Atlas instrument', () => {
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
      }),
    ];
    const model = buildRecordsIndex(entities, EMPTY_RECORDS_QUERY);
    const byId = new Map(model.rows.map((row) => [row.id, row]));
    assert.equal(byId.get('ent_school_a')?.href, '/place/union-school--ent_school_a?from=list');
    assert.equal(byId.get('ent_school_b')?.href, '/place/union-school--ent_school_b?from=list');
    assert.equal(byId.get('ent_person_a')?.href, '/entity/ent_person_a?from=list');
    assert.equal(typeof model.mappableMatched, 'number');
    assert.match(model.atlasReason, /records match/i);
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

  it('builds from search_index docs when confidenceTier is projected', () => {
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
        confidenceTier: 'high' as const,
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
        confidenceTier: 'medium' as const,
      },
    ];
    assert.equal(searchIndexReadyForRecords(docs), true);
    assert.equal(searchIndexReadyForRecords([{ ...docs[0]!, confidenceTier: undefined }]), false);
    const model = buildRecordsIndex(docs, EMPTY_RECORDS_QUERY);
    assert.equal(model.totalAll, 2);
    assert.equal(model.rows.find((row) => row.id === 'ent_a')?.grade, 'A');
    assert.equal(
      model.rows.find((row) => row.id === 'ent_a')?.href,
      '/place/alpha-place?from=list',
    );
    assert.equal(model.rows.find((row) => row.id === 'ent_b')?.href, '/entity/ent_b?from=list');
    assert.equal(model.mappableMatched, 1);
  });
});
