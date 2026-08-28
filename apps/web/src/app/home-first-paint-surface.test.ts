/**
 * First-paint surface: rooms only when this record has material; no internal ids
 * or "from their record" copy on the door.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from '../data/public-seed';
import {
  containsInternalId,
  firstPaintRecord,
  firstPaintRelation,
  firstPaintTimeline,
  humanPlaceLine,
  selectDoorRooms,
} from './home-first-paint-surface';

test('containsInternalId catches claim tokens and catalog ids', () => {
  assert.equal(containsInternalId('ent_greenwood_district_001_claim_0'), true);
  assert.equal(containsInternalId('Basis: ent_greenwood_district_001_claim_0.'), true);
  assert.equal(containsInternalId('Greenwood District'), false);
  assert.equal(containsInternalId('Status: Historic'), false);
});

test('firstPaintTimeline drops claim-id titles and strips basis shop talk', () => {
  const cleaned = firstPaintTimeline([
    {
      id: 'ent_greenwood_district_001_status_0',
      time: '1921',
      datePrecision: 'year',
      title: 'Status: Historic',
      body: 'In effect from 1921, ongoing as of this release. Basis: ent_greenwood_district_001_claim_0.',
    },
    {
      id: 'leak',
      time: '1921',
      datePrecision: 'year',
      title: 'ent_greenwood_district_001_claim_0',
      body: 'A massacre burned thirty-five blocks.',
    },
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0]?.title, 'Status: Historic');
  assert.doesNotMatch(cleaned[0]?.body ?? '', /ent_greenwood_district_001_claim_0/);
  assert.doesNotMatch(cleaned[0]?.body ?? '', /this release/i);
  assert.doesNotMatch(cleaned[0]?.body ?? '', /Basis:/i);
});

test('incoming located_at becomes a human place line, never from their record', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const greenwood = {
    ...dunbar,
    displayName: 'Greenwood District',
    locationLabel: 'Greenwood, Tulsa (neighborhood-level pin)',
    jurisdictionLabel: 'Tulsa, Oklahoma',
  };
  assert.equal(humanPlaceLine(greenwood), 'Tulsa, Oklahoma');
  const relation = firstPaintRelation(
    {
      id: 'ent_vernon_ame_001',
      displayName: 'Vernon AME Church',
      kind: 'place',
      summary: 'A church in Greenwood.',
      relationType: 'located_at',
      direction: 'incoming',
    },
    greenwood,
  );
  assert.equal(relation, 'Tulsa, Oklahoma');
  assert.doesNotMatch(relation ?? '', /from their record/i);
  assert.doesNotMatch(relation ?? '', /\brecord\b/i);
});

test('door rooms omit Law, Data, and Memorial when this record has none', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const rooms = selectDoorRooms(dunbar);
  assert.deepEqual(
    rooms.map((room) => room.id),
    ['stories'],
  );
  assert.equal(rooms[0]?.href, '#stories');
  assert.ok(!rooms.some((room) => room.href === '/stories'));
  assert.ok(!rooms.some((room) => room.href === '/law' || room.id === 'law'));
  assert.ok(!rooms.some((room) => room.href === '/data' || room.id === 'data'));
  assert.ok(!rooms.some((room) => room.href === '/memorial' || room.id === 'memorial'));
});

test('Memorial and Law appear only from this record neighbors', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const withPeople = firstPaintRecord({
    ...dunbar,
    relatedNeighbors: [
      {
        id: 'ent_person_example_001',
        displayName: 'A named neighbor',
        kind: 'person',
        summary: 'A person on this record.',
        relationType: 'associated_with',
        direction: 'outgoing',
      },
      {
        id: 'ent_law_example_001',
        displayName: 'A statute on this record',
        kind: 'law',
        summary: 'A law tied to this place.',
        relationType: 'applies_to',
        direction: 'incoming',
      },
    ],
  });
  const rooms = selectDoorRooms(withPeople);
  assert.deepEqual(
    rooms.map((room) => room.id),
    ['stories', 'law', 'memorial'],
  );
});
