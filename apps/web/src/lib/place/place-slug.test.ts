/**
 * Place slug resolution and collision hrefs.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { buildExploreMapSource } from '../map-experience/build-explore-map-source';
import {
  inventionHrefForEntity,
  isResolvablePlaceSlug,
  instrumentRecordHref,
  parsePlaceAddress,
  placeHrefForEntity,
  placeSlugCollisionCounts,
  publicRecordHref,
} from './place-slug';

describe('place slug addresses', () => {
  it('parses disambiguated entity ids', () => {
    assert.deepEqual(parsePlaceAddress('vernon-ame-church--ent_vernon_ame_001'), {
      base: 'vernon-ame-church',
      entityId: 'ent_vernon_ame_001',
    });
    assert.deepEqual(parsePlaceAddress('greenwood'), { base: 'greenwood' });
  });

  it('accepts resolvable slugs and rejects bare catalog tokens', () => {
    assert.equal(isResolvablePlaceSlug('greenwood-district'), true);
    assert.equal(isResolvablePlaceSlug('greenwood--ent_greenwood_district_001'), true);
    assert.equal(isResolvablePlaceSlug('ent_greenwood_district_001'), false);
  });

  it('disambiguates colliding display names in hrefs', () => {
    const entities = [
      { id: 'ent_a', displayName: 'Union School' },
      { id: 'ent_b', displayName: 'Union School' },
      { id: 'ent_c', displayName: 'Unique Hall' },
    ];
    const collisions = placeSlugCollisionCounts(entities);
    assert.equal(placeHrefForEntity(entities[0]!, collisions), '/place/union-school--ent_a');
    assert.equal(placeHrefForEntity(entities[2]!, collisions), '/place/unique-hall');
  });

  it('addresses an invention in its own family, not Place', () => {
    const invention = {
      id: 'inv_latimer_carbon_process',
      displayName: 'Process of Manufacturing Carbons',
      kind: 'invention',
    };
    assert.equal(
      publicRecordHref(invention),
      '/invention/process-of-manufacturing-carbons',
      'an invention is a work, not a stand',
    );
    assert.equal(
      instrumentRecordHref(invention),
      '/invention/process-of-manufacturing-carbons',
      'the invention branch runs ahead of canStandHere, which would admit it to Place',
    );
  });

  it('keeps every non-invention kind on the place family', () => {
    for (const kind of ['place', 'school', 'institution', 'organization', 'event']) {
      assert.equal(
        publicRecordHref({ id: 'ent_a', displayName: 'Union Hall', kind }),
        '/place/union-hall',
        `${kind} still addresses Place`,
      );
    }
    assert.equal(publicRecordHref({ id: 'ent_a', displayName: 'Union Hall' }), '/place/union-hall');
  });

  it('disambiguates an invention on the shared collision map', () => {
    const entities = [
      { id: 'inv_a', displayName: 'Traffic Signal', kind: 'invention' },
      { id: 'ent_b', displayName: 'Traffic Signal', kind: 'place' },
    ];
    const collisions = placeSlugCollisionCounts(entities);
    // Collision counts stay shared across families: the slug resolver searches the whole
    // release, so a name ambiguous anywhere is disambiguated in both families.
    assert.equal(
      inventionHrefForEntity(entities[0]!, collisions),
      '/invention/traffic-signal--inv_a',
    );
    assert.equal(publicRecordHref(entities[1]!, collisions), '/place/traffic-signal--ent_b');
  });

  it('routes instrument deep links by kind', () => {
    assert.equal(
      instrumentRecordHref({
        id: 'ent_a',
        displayName: 'Union School',
        kind: 'school',
        summary: 'A documented school.',
      }),
      '/place/union-school',
    );
    assert.equal(
      instrumentRecordHref({
        id: 'ent_person',
        displayName: 'Example Person',
        kind: 'person',
        summary: 'A named person.',
      }),
      '/entity/ent_person',
    );
    assert.equal(
      instrumentRecordHref({
        id: 'law_1',
        displayName: 'An Act',
        kind: 'law',
        summary: 'A statute.',
      }),
      '/law',
    );
  });

  it('map pins for people open the entity record, not the memorial room landing', () => {
    const base = listPublicEntities()[0]!;
    const person = {
      ...base,
      id: 'ent_memorial_person_001',
      kind: 'person',
      displayName: 'Example Memorial Name',
      summary: 'A named person on the map.',
    } as unknown as PublicEntityView;
    const source = buildExploreMapSource([person], {
      geoAnchorFor: () => ({
        lat: 38.91,
        lng: -77.03,
        geohash: 'dqcj',
        matchMethod: 'geocode_other',
      }),
    });
    assert.equal(
      source.featureCollection.features[0]!.properties.href,
      '/entity/ent_memorial_person_001',
    );
  });
});
