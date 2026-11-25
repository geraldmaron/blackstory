import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ShownRecord } from './shown-records';
import { RETELLING_SENTENCES } from './retelling-copy';
import { RETELLING_PICKS, pickedRecord } from './retelling-picks';
import { RECORD_SCENE_IDS, RETELLING_SCENES } from './retelling-scenes';

function record(over: Partial<ShownRecord> = {}): ShownRecord {
  return {
    entityId: 'rec-1',
    name: 'Example Church',
    locality: 'Landover, Maryland',
    href: '/place/example-church',
    lngLat: [-76.9, 38.9],
    precision: 'site',
    decade: 1870,
    person: false,
    kind: 'place',
    statePostal: 'MD',
    cameraSafe: true,
    plate: {
      url: 'https://example.org/a.jpg',
      alt: '',
      credit: 'A',
      rightsStatus: 'public_domain',
    },
    claim: {
      id: 'c',
      statement: 'Members of the congregation built the church in 1871.',
      source: { title: 'Nomination', href: 'https://example.org/n' },
      level: 'high',
    },
    ...over,
  };
}

describe('the retelling picks', () => {
  it('names one record for each record scene and no other', () => {
    assert.deepEqual(Object.keys(RETELLING_PICKS).sort(), [...RECORD_SCENE_IDS].sort());
  });

  it('never repeats a record across scenes', () => {
    const ids = Object.values(RETELLING_PICKS).map((pick) => pick.recordId);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9_-]+$/i);
  });

  it('is fixed: a pick is an id, not a rule, a list or a rotation', () => {
    for (const pick of Object.values(RETELLING_PICKS)) {
      assert.deepEqual(Object.keys(pick).sort(), ['provisional', 'recordId']);
      assert.equal(typeof pick.provisional, 'boolean');
    }
  });
});

describe('a pick against the live record', () => {
  const pick = { recordId: 'rec-1', provisional: true };

  it('shows the record when it passes every rule', () => {
    assert.equal(pickedRecord([record()], pick)?.entityId, 'rec-1');
  });

  it('shows nothing when the record is gone', () => {
    assert.equal(pickedRecord([record({ entityId: 'other' })], pick), null);
  });

  it('shows nothing once the record has no photograph', () => {
    const { plate: _plate, ...bare } = record();
    assert.equal(pickedRecord([bare], pick), null);
  });

  it('shows nothing for a thinly evidenced claim', () => {
    const thin = record({ claim: { ...record().claim, level: 'low' } });
    assert.equal(pickedRecord([thin], pick), null);
  });

  it('shows nothing for a living person or a sensitive record', () => {
    assert.equal(pickedRecord([record({ cameraSafe: false })], pick), null);
  });
});

describe('the scene sentences', () => {
  it('gives every scene between the brand panel and the name one sentence', () => {
    for (const scene of RETELLING_SCENES.slice(1, -1)) {
      const sentence = RETELLING_SENTENCES[scene.id];
      assert.ok(sentence, scene.id);
      assert.equal(sentence.match(/[.!?]/g)?.length, 1, `${scene.id}: one sentence`);
      assert.ok(sentence.startsWith(scene.heading), `${scene.id}: opens on its word`);
    }
  });

  it('follows the copy rules: no dash, no colon, no exclamation, no question', () => {
    for (const sentence of Object.values(RETELLING_SENTENCES)) {
      assert.doesNotMatch(sentence, /[—–:!?]/);
    }
  });

  it('states no year, count or name: it says what the word means and nothing else', () => {
    for (const sentence of Object.values(RETELLING_SENTENCES)) {
      assert.doesNotMatch(sentence, /\d/);
    }
  });
});
