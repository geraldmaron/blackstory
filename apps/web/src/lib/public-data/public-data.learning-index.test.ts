/**
 * Learning-index contract smoke tests for web seed entities and related hydration.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEARNING_SUMMARY_MAX_CHARS,
  LEARNING_SUMMARY_MIN_CHARS,
  validateLearningSummary,
} from '@black-book/domain';
import { listPublicEntities } from '../../data/public-seed';
import { hydrateEntityLearningLinks } from './source';

test('every seed entity summary meets the learning-index length bar', () => {
  for (const entity of listPublicEntities()) {
    const issues = validateLearningSummary(entity.summary);
    assert.equal(
      issues.length,
      0,
      `${entity.id} summary issues: ${issues.map((i) => i.message).join('; ')} (len=${entity.summary.length})`,
    );
    assert.ok(entity.summary.length >= LEARNING_SUMMARY_MIN_CHARS);
    assert.ok(entity.summary.length <= LEARNING_SUMMARY_MAX_CHARS);
    assert.ok(entity.topicTags.length > 0, `${entity.id} should carry topic tags`);
  }
});

test('seed entities hydrate related neighbors and continue-learning where graph allows', () => {
  const entities = listPublicEntities();
  const place = entities.find((e) => e.id === 'ent_15th_st_church_001');
  assert.ok(place);
  assert.ok((place.relatedNeighbors?.length ?? 0) >= 1);
  // church → school → landmark listing/institution yields 2-hop continue learning
  assert.ok((place.continueLearning?.length ?? 0) >= 1);

  const { relatedNeighbors: _rn, continueLearning: _cl, ...withoutLinks } = place;
  const rehydrated = hydrateEntityLearningLinks(withoutLinks, entities);
  assert.ok((rehydrated.relatedNeighbors?.length ?? 0) >= 1);
});

test('school seed carries optional photo and extended narrative', () => {
  const school = listPublicEntities().find((e) => e.id === 'ent_dunbar_school_001');
  assert.ok(school?.primaryImage?.url);
  assert.ok(school?.extendedNarrative);
  assert.equal(school?.primaryImage?.rightsStatus, 'public_domain');
});
