/**
 * Place slug resolution and collision hrefs.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import {
  isResolvablePlaceSlug,
  instrumentRecordHref,
  parsePlaceAddress,
  placeHrefForEntity,
  placeSlugCollisionCounts,
  resolvePlaceSlugFromSearchIndex,
} from './place-slug';

function doc(
  partial: Pick<PublicSearchIndexDoc, 'id' | 'displayName' | 'kind'> &
    Partial<PublicSearchIndexDoc>,
): PublicSearchIndexDoc {
  return {
    releaseId: 'rel_test',
    nameLower: partial.displayName.toLowerCase(),
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [],
    notabilityLabels: [],
    recordMaturity: 'published',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...partial,
  };
}

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
      '/memorial',
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
});
