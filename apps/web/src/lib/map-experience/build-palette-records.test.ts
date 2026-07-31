/**
 * Confirms the palette's record index carries subjects, not just proper nouns (repo-92n2.35):
 * the four most-searched terms in the archive each reach a record through some indexed field, a
 * name match still outranks every subject match, and the row can say which field it matched.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  rankRecords,
  type PaletteRecord,
} from '../../components/patterns/command-palette/CommandPalette';
import { buildPaletteRecords } from './build-palette-records';
import type { ExploreMapFeature } from './build-explore-map-source';

function feature(
  properties: Partial<ExploreMapFeature['properties']> & { readonly entityId: string },
): ExploreMapFeature {
  return {
    type: 'Feature',
    id: properties.entityId,
    geometry: { type: 'Point', coordinates: [-86.8, 33.5] },
    properties: {
      href: `/entity/${properties.entityId}`,
      kind: 'place',
      displayName: properties.entityId,
      oneLineStory: '',
      precision: 'city',
      geoPrecisionTier: 'city',
      eraBuckets: [],
      notabilityLabels: [],
      evidenceCount: 1,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#000000',
      glyph: 'dot',
      kindFamily: 'place',
      ...properties,
    } as ExploreMapFeature['properties'],
  };
}

/**
 * The archive's four most-searched subjects. None of them is an entity name, which is exactly why
 * a name-and-place index returned nothing for any of them.
 *
 * Two arrive through the controlled topic taxonomy (`great-migration`, `restrictive-covenants`)
 * and two through record prose, because the taxonomy carries no `redlining` or `sundown-towns`
 * topic. That gap is data work, tracked separately — the index must find these terms either way,
 * so both routes are asserted here rather than only the tidy one.
 */
const SUBJECT_FIXTURE: readonly ExploreMapFeature[] = [
  feature({
    entityId: 'ent_holc_map',
    displayName: 'Home Owners Loan Corporation survey, Birmingham',
    oneLineStory: 'Graded the city for mortgage risk, and redlining followed the lines it drew.',
    locationLabel: 'Birmingham, Alabama',
  }),
  feature({
    entityId: 'ent_anna_illinois',
    displayName: 'Anna, Illinois',
    oneLineStory: 'A sundown town whose ordinance outlived the sign at the city limit.',
    locationLabel: 'Anna, Illinois',
  }),
  feature({
    entityId: 'ent_covenant_deed',
    displayName: 'Deed of the Highland Park addition',
    topicIds: ['restrictive-covenants'],
    locationLabel: 'Detroit, Michigan',
  }),
  feature({
    entityId: 'ent_north_bound',
    displayName: 'Illinois Central platform, Greenwood',
    topicIds: ['great-migration'],
    locationLabel: 'Greenwood, Mississippi',
  }),
];

test('the four most-searched subjects each return at least one record', () => {
  const index = buildPaletteRecords(SUBJECT_FIXTURE);

  for (const query of ['redlining', 'sundown town', 'restrictive covenant', 'Great Migration']) {
    const hits = rankRecords(index, query);
    assert.ok(hits.length >= 1, `"${query}" returned no record from the palette index`);
  }
});

test('a subject hit reports the field it matched, never a bare place line', () => {
  const index = buildPaletteRecords(SUBJECT_FIXTURE);

  const covenant = rankRecords(index, 'restrictive covenant')[0];
  assert.ok(covenant);
  assert.equal(covenant.matchedField, 'topic');
  // The taxonomy label, not the slug: `restrictive-covenants` is not what a reader typed.
  assert.equal(covenant.matchedText, 'Restrictive Covenants');

  const redlining = rankRecords(index, 'redlining')[0];
  assert.ok(redlining);
  assert.equal(redlining.matchedField, 'summary');
});

test('a name match outranks a subject match on the same query', () => {
  const index = buildPaletteRecords([
    feature({ entityId: 'named', displayName: 'Greenwood District' }),
    feature({
      entityId: 'summarized',
      displayName: 'Mount Zion Baptist Church',
      oneLineStory: 'Burned in the Greenwood District, and rebuilt on the same foundation.',
    }),
  ]);

  const hits = rankRecords(index, 'Greenwood District');
  assert.equal(hits.length, 2);
  assert.equal(hits[0]!.record.id, 'named');
  assert.equal(hits[0]!.matchedField, 'name');
});

test('a place match outranks a subject match, and both stay below the name', () => {
  const index = buildPaletteRecords([
    feature({
      entityId: 'in-birmingham',
      displayName: 'Sixteenth Street Baptist Church',
      locationLabel: 'Birmingham, Alabama',
    }),
    feature({
      entityId: 'about-birmingham',
      displayName: 'Letter from the county jail',
      oneLineStory: 'Written in Birmingham, addressed to eight clergymen.',
    }),
  ]);

  const ranked = rankRecords(index, 'Birmingham');
  assert.deepEqual(
    ranked.map((entry) => entry.record.id),
    ['in-birmingham', 'about-birmingham'],
  );
});

test('a record with no subject fields still ranks on name and place alone', () => {
  const bare: readonly PaletteRecord[] = [
    { id: 'bare', name: 'Dunbar High School', place: 'Washington, D.C.' },
  ];
  assert.equal(rankRecords(bare, 'Dunbar')[0]?.matchedField, 'name');
  assert.equal(rankRecords(bare, 'Washington')[0]?.matchedField, 'place');
  assert.equal(rankRecords(bare, 'redlining').length, 0);
});

test('an unrecognized topic id indexes on its humanized slug rather than disappearing', () => {
  const index = buildPaletteRecords([
    feature({ entityId: 'x', displayName: 'A record', topicIds: ['not-a-real-topic'] }),
  ]);
  const hit = rankRecords(index, 'not a real topic')[0];
  assert.ok(hit);
  assert.equal(hit.matchedText, 'not a real topic');
});

test('the index carries every feature it is given, with no record dropped for a missing field', () => {
  const index = buildPaletteRecords(SUBJECT_FIXTURE);
  assert.equal(index.length, SUBJECT_FIXTURE.length);
  for (const record of index) {
    assert.ok(record.id.length > 0);
    assert.ok(record.name.length > 0);
    assert.ok(record.place.length > 0);
  }
});
